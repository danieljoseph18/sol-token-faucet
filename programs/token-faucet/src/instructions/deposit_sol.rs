use crate::FaucetState;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(
        mut,
        seeds = [b"faucet_state"],
        bump = faucet_state.bump,
        has_one = admin
    )]
    pub faucet_state: Account<'info, FaucetState>,

    #[account(
        mut,
        seeds = [b"sol_vault"],
        bump,
    )]
    pub faucet_sol_vault: SystemAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
    // Transfer SOL from admin to program account
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.admin.to_account_info(),
            to: ctx.accounts.faucet_sol_vault.to_account_info(),
        },
    );

    anchor_lang::system_program::transfer(cpi_context, amount)?;

    Ok(())
}
