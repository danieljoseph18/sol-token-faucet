import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenFaucet } from "../target/types/token_faucet";

// Deposit SOL into the faucet
async function main() {
  // Configure the client to use devnet
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load the program
  const program = anchor.workspace.TokenFaucet as Program<TokenFaucet>;
  console.log("Program ID:", program.programId.toString());

  // Get the admin from the configured keypair
  const admin = provider.wallet.payer;
  console.log("Admin pubkey:", admin.publicKey.toString());

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

  // Check admin SOL balance
  const adminBalance = await provider.connection.getBalance(admin.publicKey);
  console.log(
    "Admin SOL balance:",
    adminBalance / anchor.web3.LAMPORTS_PER_SOL,
    "SOL"
  );

  // Check current SOL vault balance
  const vaultBalanceBefore = await provider.connection.getBalance(
    faucetSolVaultAddress
  );
  console.log(
    "Current SOL vault balance:",
    vaultBalanceBefore / anchor.web3.LAMPORTS_PER_SOL,
    "SOL"
  );

  // Define deposit amount (default to 1 SOL)
  const args = process.argv.slice(2);
  const depositAmount =
    args.length > 0
      ? parseFloat(args[0]) * anchor.web3.LAMPORTS_PER_SOL
      : 1 * anchor.web3.LAMPORTS_PER_SOL;

  console.log(
    `Depositing ${depositAmount / anchor.web3.LAMPORTS_PER_SOL} SOL...`
  );

  try {
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

    console.log("SOL deposit successful!");

    // Verify SOL balance
    const vaultBalanceAfter = await provider.connection.getBalance(
      faucetSolVaultAddress
    );
    console.log(
      "New SOL vault balance:",
      vaultBalanceAfter / anchor.web3.LAMPORTS_PER_SOL,
      "SOL"
    );
    console.log(
      `Added ${
        (vaultBalanceAfter - vaultBalanceBefore) / anchor.web3.LAMPORTS_PER_SOL
      } SOL to the vault`
    );
  } catch (e) {
    console.error("Error depositing SOL:", e);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
