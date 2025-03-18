use crate::state::FaucetState;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 32 + 32 + 1 + 1, // discriminator + admin pubkey + usdc_mint + usdc_vault + bump + sol_vault_bump
        seeds = [b"faucet_state"],
        bump
    )]
    pub faucet_state: Account<'info, FaucetState>,

    #[account(
        seeds = [b"sol_vault"],
        bump,
    )]
    pub faucet_sol_vault: SystemAccount<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        seeds = [b"usdc_vault"],
        bump,
        token::mint = usdc_mint,
        token::authority = faucet_state,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let faucet_state = &mut ctx.accounts.faucet_state;
    faucet_state.admin = ctx.accounts.admin.key();
    faucet_state.usdc_mint = ctx.accounts.usdc_mint.key();
    faucet_state.usdc_vault = ctx.accounts.usdc_vault.key();
    faucet_state.bump = ctx.bumps.faucet_state;
    faucet_state.sol_vault_bump = ctx.bumps.faucet_sol_vault;

    Ok(())
}
