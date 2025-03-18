use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::FaucetState;

#[derive(Accounts)]
pub struct DepositUsdc<'info> {
    #[account(
        seeds = [b"faucet_state"],
        bump = faucet_state.bump,
        has_one = admin,
        has_one = usdc_vault
    )]
    pub faucet_state: Account<'info, FaucetState>,

    #[account(mut)]
    pub usdc_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub admin_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn deposit_usdc(ctx: Context<DepositUsdc>, amount: u64) -> Result<()> {
    // Transfer USDC from admin to program vault
    let cpi_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.admin_usdc_account.to_account_info(),
            to: ctx.accounts.usdc_vault.to_account_info(),
            authority: ctx.accounts.admin.to_account_info(),
        },
    );

    token::transfer(cpi_context, amount)?;

    Ok(())
}
