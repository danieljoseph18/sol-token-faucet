use anchor_lang::prelude::*;

#[error_code]
pub enum FaucetError {
    #[msg("User has already claimed from this faucet")]
    AlreadyClaimed,
    #[msg("Insufficient SOL balance in faucet")]
    InsufficientSolBalance,
}
