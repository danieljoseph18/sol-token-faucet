use anchor_lang::prelude::*;

#[account]
pub struct FaucetState {
    pub admin: Pubkey,
    pub usdc_mint: Pubkey,
    pub usdc_vault: Pubkey,
    pub bump: u8,
    pub sol_vault_bump: u8,
}

#[account]
#[derive(Default)]
pub struct UserClaim {
    pub has_claimed: bool,
}
