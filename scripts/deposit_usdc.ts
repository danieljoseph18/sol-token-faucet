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
import * as fs from "fs";

// Deposit USDC into the faucet
async function main() {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load the program
  const program = anchor.workspace.TokenFaucet as Program<TokenFaucet>;
  console.log("Program ID:", program.programId.toString());

  // Load the admin keypair
  let admin: anchor.web3.Keypair;
  try {
    const adminKeypairFile = fs.readFileSync("admin-keypair.json", "utf-8");
    const adminKeypairData = JSON.parse(adminKeypairFile);
    admin = anchor.web3.Keypair.fromSecretKey(new Uint8Array(adminKeypairData));
    console.log("Admin pubkey:", admin.publicKey.toString());
  } catch (e) {
    console.error(
      "Admin keypair not found. Please run initialize script first."
    );
    return;
  }

  // Load or create USDC mint
  let usdcMint: anchor.web3.PublicKey;
  try {
    const usdcMintStr = fs.readFileSync("usdc-mint.txt", "utf-8").trim();
    usdcMint = new anchor.web3.PublicKey(usdcMintStr);
    console.log("USDC mint:", usdcMint.toString());

    // Verify the mint exists
    await getMint(provider.connection, usdcMint);
  } catch (e) {
    console.error(
      "USDC mint not found or invalid. Please run initialize script first."
    );
    return;
  }

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
  const depositAmount =
    args.length > 0 ? parseInt(args[0]) * 1_000_000 : 5_000_000_000; // 5000 USDC with 6 decimals

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
