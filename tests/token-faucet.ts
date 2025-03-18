// tests/solana-faucet.ts
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenFaucet } from "../target/types/token_faucet";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { assert } from "chai";

describe("solana-faucet", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenFaucet as Program<TokenFaucet>;
  const admin = anchor.web3.Keypair.generate();
  const user = anchor.web3.Keypair.generate();

  let usdcMint: anchor.web3.PublicKey;
  let adminUsdcAccount: anchor.web3.PublicKey;
  let userUsdcAccount: anchor.web3.PublicKey;
  let faucetStateAddress: anchor.web3.PublicKey;
  let faucetSolVaultAddress: anchor.web3.PublicKey;
  let usdcVaultAddress: anchor.web3.PublicKey;
  let userClaimAddress: anchor.web3.PublicKey;

  const SOL_CLAIM_AMOUNT = 100_000_000; // 0.1 SOL in lamports
  const USDC_CLAIM_AMOUNT = 1_000_000_000; // 1000 USDC (assuming 6 decimals)

  before(async () => {
    // Airdrop SOL to admin and user
    const adminAirdropTx = await provider.connection.requestAirdrop(
      admin.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(adminAirdropTx);

    const userAirdropTx = await provider.connection.requestAirdrop(
      user.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(userAirdropTx);

    console.log("Airdropped SOL to admin and user");

    // Create USDC mint (with 6 decimals)
    usdcMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6
    );

    console.log("Created USDC mint");

    // Create admin's USDC account and mint tokens
    adminUsdcAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin,
      usdcMint,
      admin.publicKey
    );

    console.log("Created usdc ata");

    // Mint USDC to admin (10,000 USDC)
    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      adminUsdcAccount,
      admin.publicKey,
      10_000_000_000
    );

    console.log("Minted USDC to admin");

    // Create user's USDC account
    userUsdcAccount = await createAssociatedTokenAccount(
      provider.connection,
      user,
      usdcMint,
      user.publicKey
    );

    console.log("Created user's USDC account");

    // Derive PDA addresses
    [faucetStateAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("faucet_state")],
      program.programId
    );

    console.log("Derived faucet state address");

    [faucetSolVaultAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("sol_vault")],
      program.programId
    );

    console.log("Derived faucet sol vault address");

    [usdcVaultAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("usdc_vault")],
      program.programId
    );

    console.log("Derived usdc vault address");

    [userClaimAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_claim"), user.publicKey.toBuffer()],
      program.programId
    );

    console.log("Derived user claim address");
  });

  it("Initializes the faucet", async () => {
    console.log("Initializing faucet");
    await program.methods
      .initialize()
      .accountsStrict({
        faucetState: faucetStateAddress,
        faucetSolVault: faucetSolVaultAddress,
        usdcMint: usdcMint,
        usdcVault: usdcVaultAddress,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([admin])
      .rpc();

    // Verify faucet state
    const faucetState = await program.account.faucetState.fetch(
      faucetStateAddress
    );
    assert.equal(faucetState.admin.toString(), admin.publicKey.toString());
    assert.equal(faucetState.usdcMint.toString(), usdcMint.toString());
    assert.equal(faucetState.usdcVault.toString(), usdcVaultAddress.toString());
  });

  it("Admin deposits SOL", async () => {
    const depositAmount = 1 * anchor.web3.LAMPORTS_PER_SOL; // 1 SOL

    await program.methods
      .depositSol(new anchor.BN(depositAmount))
      .accounts({
        faucetState: faucetStateAddress,
        faucetSolVault: faucetSolVaultAddress,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    // Verify SOL balance
    const solBalance = await provider.connection.getBalance(
      faucetSolVaultAddress
    );
    assert.equal(solBalance, depositAmount);
  });

  it("Admin deposits USDC", async () => {
    const depositAmount = 5_000_000_000; // 5000 USDC

    await program.methods
      .depositUsdc(new anchor.BN(depositAmount))
      .accountsStrict({
        faucetState: faucetStateAddress,
        usdcVault: usdcVaultAddress,
        adminUsdcAccount: adminUsdcAccount,
        admin: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();

    // Verify USDC balance
    const tokenAccountInfo = await provider.connection.getTokenAccountBalance(
      usdcVaultAddress
    );
    assert.equal(Number(tokenAccountInfo.value.amount), depositAmount);
  });

  it("User claims SOL and USDC", async () => {
    // Get user SOL balance before claim
    const userSolBalanceBefore = await provider.connection.getBalance(
      user.publicKey
    );

    // Get user USDC balance before claim
    const userUsdcBalanceBefore =
      await provider.connection.getTokenAccountBalance(userUsdcAccount);

    await program.methods
      .claim()
      .accountsStrict({
        faucetState: faucetStateAddress,
        faucetSolVault: faucetSolVaultAddress,
        usdcVault: usdcVaultAddress,
        userClaimAccount: userClaimAddress,
        user: user.publicKey,
        userUsdcAccount: userUsdcAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    // Verify user's SOL balance increased
    const userSolBalanceAfter = await provider.connection.getBalance(
      user.publicKey
    );
    // We need to account for transaction fees in the check
    assert.isTrue(
      userSolBalanceAfter > userSolBalanceBefore &&
        userSolBalanceAfter < userSolBalanceBefore + SOL_CLAIM_AMOUNT
    );

    // Verify user's USDC balance increased
    const userUsdcBalanceAfter =
      await provider.connection.getTokenAccountBalance(userUsdcAccount);
    assert.equal(
      Number(userUsdcBalanceAfter.value.amount),
      Number(userUsdcBalanceBefore.value.amount) + USDC_CLAIM_AMOUNT
    );

    // Verify user claim is marked as claimed
    const userClaim = await program.account.userClaim.fetch(userClaimAddress);
    assert.isTrue(userClaim.hasClaimed);
  });

  it("User cannot claim twice", async () => {
    try {
      await program.methods
        .claim()
        .accountsStrict({
          faucetState: faucetStateAddress,
          faucetSolVault: faucetSolVaultAddress,
          usdcVault: usdcVaultAddress,
          userClaimAccount: userClaimAddress,
          user: user.publicKey,
          userUsdcAccount: userUsdcAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      assert.fail("Expected claim to fail, but it succeeded");
    } catch (err) {
      assert.include(
        err.toString(),
        "User has already claimed from this faucet"
      );
    }
  });
});
