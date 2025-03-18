use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{FaucetError, FaucetState, UserClaim, SOL_CLAIM_AMOUNT, USDC_CLAIM_AMOUNT};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        seeds = [b"faucet_state"],
        bump = faucet_state.bump,
        has_one = usdc_vault
    )]
    pub faucet_state: Account<'info, FaucetState>,

    #[account(
        mut,
        seeds = [b"sol_vault"],
        bump = faucet_state.sol_vault_bump,
    )]
    pub faucet_sol_vault: SystemAccount<'info>,

    #[account(mut)]
    pub usdc_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 1, // discriminator + bool
        seeds = [b"user_claim", user.key().as_ref()],
        bump
    )]
    pub user_claim_account: Account<'info, UserClaim>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = user_usdc_account.owner == user.key(),
        constraint = user_usdc_account.mint == faucet_state.usdc_mint
    )]
    pub user_usdc_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn claim(ctx: Context<Claim>) -> Result<()> {
    // Check if user has already claimed
    let user_claim_account = &mut ctx.accounts.user_claim_account;
    require!(!user_claim_account.has_claimed, FaucetError::AlreadyClaimed);

    // Transfer SOL from vault to user
    let sol_amount = SOL_CLAIM_AMOUNT;
    let sol_vault_balance = ctx.accounts.faucet_sol_vault.lamports();
    require!(
        sol_vault_balance >= sol_amount,
        FaucetError::InsufficientSolBalance
    );

    // Use system program to transfer SOL from vault to user with proper signer
    let sol_vault_seeds = &[b"sol_vault".as_ref(), &[ctx.accounts.faucet_state.sol_vault_bump]];
    let sol_vault_signer = &[&sol_vault_seeds[..]];

    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.faucet_sol_vault.to_account_info(),
                to: ctx.accounts.user.to_account_info(),
            },
            sol_vault_signer,
        ),
        sol_amount,
    )?;

    // Transfer USDC from vault to user
    let usdc_amount = USDC_CLAIM_AMOUNT;
    let faucet_state = &ctx.accounts.faucet_state;
    let seeds = &[b"faucet_state".as_ref(), &[faucet_state.bump]];
    let signer = &[&seeds[..]];

    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.usdc_vault.to_account_info(),
            to: ctx.accounts.user_usdc_account.to_account_info(),
            authority: ctx.accounts.faucet_state.to_account_info(),
        },
        signer,
    );

    token::transfer(cpi_context, usdc_amount)?;

    // Mark user as claimed
    user_claim_account.has_claimed = true;

    Ok(())
}
