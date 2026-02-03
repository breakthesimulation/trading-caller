use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer};

declare_id!("MorphTreasury111111111111111111111111111111");

#[program]
pub mod morpheus_treasury {
    use super::*;

    /// Initialize the treasury with configuration
    pub fn initialize(
        ctx: Context<Initialize>,
        subscription_price: u64,  // Price in USDC lamports (6 decimals)
        subscription_days: u16,   // Subscription duration in days
    ) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.authority = ctx.accounts.authority.key();
        treasury.usdc_vault = ctx.accounts.usdc_vault.key();
        treasury.subscription_price = subscription_price;
        treasury.subscription_days = subscription_days;
        treasury.total_subscribers = 0;
        treasury.total_revenue = 0;
        treasury.bump = ctx.bumps.treasury;
        
        msg!("Treasury initialized with price: {} USDC for {} days", 
             subscription_price / 1_000_000, subscription_days);
        Ok(())
    }

    /// Subscribe to MORPHEUS signals
    pub fn subscribe(ctx: Context<Subscribe>) -> Result<()> {
        let treasury = &ctx.accounts.treasury;
        let subscription = &mut ctx.accounts.subscription;
        
        // Transfer USDC from subscriber to vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.subscriber_usdc.to_account_info(),
                to: ctx.accounts.usdc_vault.to_account_info(),
                authority: ctx.accounts.subscriber.to_account_info(),
            },
        );
        anchor_spl::token::transfer(transfer_ctx, treasury.subscription_price)?;

        // Update subscription
        let clock = Clock::get()?;
        subscription.subscriber = ctx.accounts.subscriber.key();
        subscription.started_at = clock.unix_timestamp;
        subscription.expires_at = clock.unix_timestamp + (treasury.subscription_days as i64 * 86400);
        subscription.is_active = true;
        subscription.bump = ctx.bumps.subscription;

        // Update treasury stats
        let treasury = &mut ctx.accounts.treasury;
        treasury.total_subscribers += 1;
        treasury.total_revenue += treasury.subscription_price;

        msg!("New subscription! Expires at: {}", subscription.expires_at);
        Ok(())
    }

    /// Check if a subscription is active
    pub fn check_subscription(ctx: Context<CheckSubscription>) -> Result<bool> {
        let subscription = &ctx.accounts.subscription;
        let clock = Clock::get()?;
        
        let is_active = subscription.is_active && clock.unix_timestamp < subscription.expires_at;
        msg!("Subscription active: {}", is_active);
        Ok(is_active)
    }

    /// Store a signal hash on-chain for verification
    pub fn store_signal_hash(
        ctx: Context<StoreSignalHash>,
        signal_id: String,
        signal_hash: [u8; 32],
    ) -> Result<()> {
        let signal_record = &mut ctx.accounts.signal_record;
        let clock = Clock::get()?;

        signal_record.signal_id = signal_id.clone();
        signal_record.signal_hash = signal_hash;
        signal_record.timestamp = clock.unix_timestamp;
        signal_record.authority = ctx.accounts.authority.key();
        signal_record.bump = ctx.bumps.signal_record;

        msg!("Signal stored: {}", signal_id);
        Ok(())
    }

    /// Withdraw accumulated fees (authority only)
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let treasury = &ctx.accounts.treasury;
        
        // Create signer seeds for PDA
        let seeds = &[
            b"treasury".as_ref(),
            &[treasury.bump],
        ];
        let signer = &[&seeds[..]];

        // Transfer from vault to authority
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.usdc_vault.to_account_info(),
                to: ctx.accounts.authority_usdc.to_account_info(),
                authority: ctx.accounts.treasury.to_account_info(),
            },
            signer,
        );
        anchor_spl::token::transfer(transfer_ctx, amount)?;

        msg!("Withdrawn {} USDC", amount / 1_000_000);
        Ok(())
    }
}

// === Account Structures ===

#[account]
pub struct Treasury {
    pub authority: Pubkey,
    pub usdc_vault: Pubkey,
    pub subscription_price: u64,
    pub subscription_days: u16,
    pub total_subscribers: u64,
    pub total_revenue: u64,
    pub bump: u8,
}

#[account]
pub struct Subscription {
    pub subscriber: Pubkey,
    pub started_at: i64,
    pub expires_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
pub struct SignalRecord {
    pub signal_id: String,
    pub signal_hash: [u8; 32],
    pub timestamp: i64,
    pub authority: Pubkey,
    pub bump: u8,
}

// === Contexts ===

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 2 + 8 + 8 + 1,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    /// CHECK: USDC vault account
    pub usdc_vault: AccountInfo<'info>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Subscribe<'info> {
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(
        init,
        payer = subscriber,
        space = 8 + 32 + 8 + 8 + 1 + 1,
        seeds = [b"subscription", subscriber.key().as_ref()],
        bump
    )]
    pub subscription: Account<'info, Subscription>,
    
    #[account(mut)]
    pub subscriber: Signer<'info>,
    
    #[account(mut)]
    pub subscriber_usdc: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub usdc_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckSubscription<'info> {
    #[account(
        seeds = [b"subscription", subscriber.key().as_ref()],
        bump = subscription.bump
    )]
    pub subscription: Account<'info, Subscription>,
    
    pub subscriber: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(signal_id: String)]
pub struct StoreSignalHash<'info> {
    #[account(
        seeds = [b"treasury"],
        bump = treasury.bump,
        has_one = authority
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 64 + 32 + 8 + 32 + 1,
        seeds = [b"signal", signal_id.as_bytes()],
        bump
    )]
    pub signal_record: Account<'info, SignalRecord>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [b"treasury"],
        bump = treasury.bump,
        has_one = authority
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(mut)]
    pub usdc_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub authority_usdc: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

// === Errors ===

#[error_code]
pub enum MorpheusError {
    #[msg("Subscription has expired")]
    SubscriptionExpired,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
}
