from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from database import SessionLocal
from models import User
from service import PriceService
from strategy import CSFloatStrategy
import datetime
import logging

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scheduler")

def check_portfolio_notifications():
    """
    Checks for users who have scheduled a portfolio update for the current time.
    Time is in UTC (HH:MM).
    """
    # Use UTC now
    now = datetime.datetime.utcnow()
    current_time_str = now.strftime("%H:%M")
    
    # logger.info(f"Scheduler tick: {current_time_str}")
    
    db = SessionLocal()
    try:
        # Get users with notification enabled AND matching time
        # We check filters: webhook_url IS NOT NULL and time == current_time
        users = db.query(User).filter(
            User.discord_portfolio_webhook_url != None,
            User.discord_portfolio_webhook_url != "",
            User.discord_portfolio_notification_time == current_time_str
        ).all()
        
        if not users:
            return # Silent if no work

        logger.info(f"Found {len(users)} users scheduled for update at {current_time_str}")
        
        strategy = CSFloatStrategy()
        # Note: PriceService uses requests (sync) and db operations.
        # Since this runs in a thread pool executor (default for sync functions in AsyncIOScheduler),
        # blocking is okay and won't freeze the main event loop.
        service = PriceService(db, strategy)
        
        for user in users:
            try:
                logger.info(f"Running scheduled update for user: {user.username} (ID: {user.user_id})")
                service.update_portfolio_prices(user.user_id)
                logger.info(f"Update completed for user: {user.username}")
            except Exception as e:
                logger.error(f"Failed to update portfolio for user {user.user_id}: {e}")
                
    except Exception as e:
        logger.error(f"Scheduler loop error: {e}")
    finally:
        db.close()

scheduler = AsyncIOScheduler()

def start_scheduler():
    # Cron trigger: execute every minute
    # This checks if the current minute matches the user's setting
    scheduler.add_job(check_portfolio_notifications, "cron", minute='*')
    scheduler.start()
    logger.info("Portfolio Notification Scheduler started (UTC).")
