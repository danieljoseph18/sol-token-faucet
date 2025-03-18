import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenFaucet } from "../target/types/token_faucet";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  getAssociatedTokenAddress,
  getAccount,
  mintTo,
  getMint,
} from "@solana/spl-token";
import * as dotenv from "dotenv";

dotenv.config();

// Deposit USDC into the faucet
async function main() {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load the program
  const program = anchor.workspace.TokenFaucet as Program<TokenFaucet>;
  console.log("Program ID:", program.programId.toString());

  // Get the admin from the configured keypair
  const admin = provider.wallet.payer;
  console.log("Admin pubkey:", admin.publicKey.toString());

  // Load or create USDC mint
  const usdcMint = new anchor.web3.PublicKey(
    "7ggkvgP7jijLpQBV5GXcqugTMrc2JqDi9tiCH36SVg7A"
  );

  // Derive PDA addresses
  const [faucetStateAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("faucet_state")],
    program.programId
  );
  console.log("Faucet state address:", faucetStateAddress.toString());

  const [usdcVaultAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault")],
    program.programId
  );
  console.log("USDC vault address:", usdcVaultAddress.toString());

  // Get or create the admin's USDC account
  console.log("Setting up admin's USDC account...");
  let adminUsdcAccount: anchor.web3.PublicKey;
  try {
    adminUsdcAccount = await getAssociatedTokenAddress(
      usdcMint,
      admin.publicKey
    );

    try {
      // Check if the account exists
      await getAccount(provider.connection, adminUsdcAccount);
      console.log("Admin USDC account exists:", adminUsdcAccount.toString());
    } catch (e) {
      // Create the account if it doesn't exist
      console.log("Creating admin USDC account...");
      adminUsdcAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin,
        usdcMint,
        admin.publicKey
      );
      console.log("Admin USDC account created:", adminUsdcAccount.toString());
    }

    // Mint some USDC to the admin (if needed)
    const adminTokenAccount = await getAccount(
      provider.connection,
      adminUsdcAccount
    );
    if (Number(adminTokenAccount.amount) < 1000_000_000) {
      // Less than 1000 USDC
      console.log("Minting 10,000 USDC to admin...");
      await mintTo(
        provider.connection,
        admin,
        usdcMint,
        adminUsdcAccount,
        admin.publicKey,
        10_000_000_000 // 10,000 USDC with 6 decimals
      );
    }

    // Display admin's USDC balance
    const updatedAdminAccount = await getAccount(
      provider.connection,
      adminUsdcAccount
    );
    console.log(
      "Admin USDC balance:",
      Number(updatedAdminAccount.amount) / 1_000_000,
      "USDC"
    );
  } catch (e) {
    console.error("Error setting up admin's USDC account:", e);
    return;
  }

  // Check current USDC vault balance
  try {
    const vaultTokenAccount = await getAccount(
      provider.connection,
      usdcVaultAddress
    );
    console.log(
      "Current USDC vault balance:",
      Number(vaultTokenAccount.amount) / 1_000_000,
      "USDC"
    );
  } catch (e) {
    console.log("USDC vault may not be initialized yet or has no balance");
  }

  // Define deposit amount (default to 5000 USDC)
  const args = process.argv.slice(2);
  let depositAmount: number;

  if (args.length === 0) {
    console.log("No amount specified. Using default amount of 5000 USDC.");
    depositAmount = 5_000_000_000; // 5000 USDC with 6 decimals
  } else {
    const amount = parseFloat(args[0]);
    if (isNaN(amount) || amount <= 0) {
      console.error(
        "Error: Please provide a valid positive number for the deposit amount."
      );
      console.log("Usage: ts-node scripts/deposit_usdc.ts [amount]");
      console.log("Example: ts-node scripts/deposit_usdc.ts 1000");
      process.exit(1);
    }
    depositAmount = amount * 1_000_000; // Convert to USDC decimals (6)
  }

  console.log(`Depositing ${depositAmount / 1_000_000} USDC...`);

  try {
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

    console.log("USDC deposit successful!");

    // Verify USDC balance
    const vaultTokenAccount = await getAccount(
      provider.connection,
      usdcVaultAddress
    );
    console.log(
      "New USDC vault balance:",
      Number(vaultTokenAccount.amount) / 1_000_000,
      "USDC"
    );
  } catch (e) {
    console.error("Error depositing USDC:", e);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
