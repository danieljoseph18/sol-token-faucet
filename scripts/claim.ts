import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenFaucet } from "../target/types/token_faucet";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccount,
} from "@solana/spl-token";
import * as fs from "fs";

// Constants from program
const SOL_CLAIM_AMOUNT = 100_000_000; // 0.1 SOL in lamports
const USDC_CLAIM_AMOUNT = 1_000_000_000; // 1000 USDC (assuming 6 decimals)

// Claim tokens from the faucet
async function main() {
  // Configure the client to use devnet
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load the program
  const program = anchor.workspace.TokenFaucet as Program<TokenFaucet>;
  console.log("Program ID:", program.programId.toString());

  // Get the user from the configured keypair
  const user = provider.wallet.payer;
  console.log("User pubkey:", user.publicKey.toString());

  // Check user SOL balance
  const userSolBalanceBefore = await provider.connection.getBalance(
    user.publicKey
  );
  console.log(
    "User SOL balance before claim:",
    userSolBalanceBefore / anchor.web3.LAMPORTS_PER_SOL,
    "SOL"
  );

  // If user has less than 0.05 SOL, airdrop some to pay for transaction fees
  if (userSolBalanceBefore < 50_000_000) {
    console.log("User has low SOL balance, airdropping 0.1 SOL for fees...");
    try {
      const airdropTx = await provider.connection.requestAirdrop(
        user.publicKey,
        0.1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropTx);
      console.log("Airdropped 0.1 SOL to user for fees");
    } catch (e) {
      console.warn("Failed to airdrop SOL to user:", e);
    }
  }

  // Load USDC mint
  let usdcMint: anchor.web3.PublicKey;
  try {
    const usdcMintStr = fs.readFileSync("usdc-mint.txt", "utf-8").trim();
    usdcMint = new anchor.web3.PublicKey(usdcMintStr);
    console.log("USDC mint:", usdcMint.toString());
  } catch (e) {
    console.error("USDC mint not found. Please run initialize script first.");
    return;
  }

  // Derive PDA addresses
  const [faucetStateAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("faucet_state")],
    program.programId
  );
  console.log("Faucet state address:", faucetStateAddress.toString());

  const [faucetSolVaultAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("sol_vault")],
    program.programId
  );
  console.log("Faucet SOL vault address:", faucetSolVaultAddress.toString());

  const [usdcVaultAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault")],
    program.programId
  );
  console.log("USDC vault address:", usdcVaultAddress.toString());

  const [userClaimAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user_claim"), user.publicKey.toBuffer()],
    program.programId
  );
  console.log("User claim address:", userClaimAddress.toString());

  // Check if user has already claimed
  try {
    const userClaim = await program.account.userClaim.fetch(userClaimAddress);
    if (userClaim.hasClaimed) {
      console.log("User has already claimed from this faucet.");
      return;
    }
  } catch (e) {
    // Account doesn't exist yet, which is fine
    console.log("User hasn't claimed yet - proceeding...");
  }

  // Get or create user's USDC account
  console.log("Setting up user's USDC account...");
  let userUsdcAccount: anchor.web3.PublicKey;
  try {
    userUsdcAccount = await getAssociatedTokenAddress(usdcMint, user.publicKey);

    try {
      // Check if the account exists
      await getAccount(provider.connection, userUsdcAccount);
      console.log("User USDC account exists:", userUsdcAccount.toString());

      // Get user's current USDC balance
      const userTokenAccount = await getAccount(
        provider.connection,
        userUsdcAccount
      );
      console.log(
        "User USDC balance before claim:",
        Number(userTokenAccount.amount) / 1_000_000,
        "USDC"
      );
    } catch (e) {
      // Create the account if it doesn't exist
      console.log("Creating user USDC account...");
      userUsdcAccount = await createAssociatedTokenAccount(
        provider.connection,
        user,
        usdcMint,
        user.publicKey
      );
      console.log("User USDC account created:", userUsdcAccount.toString());
      console.log("User USDC balance before claim: 0 USDC");
    }
  } catch (e) {
    console.error("Error setting up user's USDC account:", e);
    return;
  }

  // Claim from faucet
  console.log("Claiming from faucet...");
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

    console.log("Claim successful!");

    // Verify user's SOL balance increased
    const userSolBalanceAfter = await provider.connection.getBalance(
      user.publicKey
    );
    console.log(
      "User SOL balance after claim:",
      userSolBalanceAfter / anchor.web3.LAMPORTS_PER_SOL,
      "SOL"
    );
    console.log(
      `SOL increase: ${
        (userSolBalanceAfter - userSolBalanceBefore) /
        anchor.web3.LAMPORTS_PER_SOL
      } SOL`
    );

    // Verify user's USDC balance increased
    const userUsdcAccountAfter = await getAccount(
      provider.connection,
      userUsdcAccount
    );
    console.log(
      "User USDC balance after claim:",
      Number(userUsdcAccountAfter.amount) / 1_000_000,
      "USDC"
    );

    // Verify user claim is marked as claimed
    const userClaim = await program.account.userClaim.fetch(userClaimAddress);
    console.log(
      "User claim status:",
      userClaim.hasClaimed ? "Claimed" : "Not claimed"
    );
  } catch (e) {
    console.error("Error claiming from faucet:", e);
    if (e.toString().includes("User has already claimed")) {
      console.log("This user has already claimed from the faucet.");
    }
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
