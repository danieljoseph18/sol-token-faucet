import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenFaucet } from "../target/types/token_faucet";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";

// Initialize the faucet with devnet USDC mint
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

  // Use devnet USDC mint address
  console.log("Using devnet USDC mint...");
  const usdcMint = new anchor.web3.PublicKey(
    "7ggkvgP7jijLpQBV5GXcqugTMrc2JqDi9tiCH36SVg7A"
  );
  console.log("USDC mint address:", usdcMint.toString());
  fs.writeFileSync("usdc-mint.txt", usdcMint.toString());

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

  // Initialize the faucet
  console.log("Initializing faucet...");
  try {
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
    console.log("Faucet initialized successfully!");

    // Fetch and display faucet state
    const faucetState = await program.account.faucetState.fetch(
      faucetStateAddress
    );
    console.log("Faucet state:", {
      admin: faucetState.admin.toString(),
      usdcMint: faucetState.usdcMint.toString(),
      usdcVault: faucetState.usdcVault.toString(),
      bump: faucetState.bump,
      solVaultBump: faucetState.solVaultBump,
    });
  } catch (e) {
    console.error("Error initializing faucet:", e);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
