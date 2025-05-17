const schedule = require('node-schedule');
const CompanyApiConfig = require('../models/CompanyApiConfig');
const { syncCompanyProducts } = require('../controllers/companyApiController');

// Schedule hourly sync
schedule.scheduleJob('0 * * * *', async () => {
  try {
    const hourlyConfigs = await CompanyApiConfig.find({
      isActive: true,
      'syncSchedule.frequency': 'hourly'
    });

    for (const config of hourlyConfigs) {
      try {
        await syncCompanyProducts(config._id);
      } catch (error) {
        console.error(`Failed to sync company ${config.company}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in hourly sync:', error);
  }
});

// Schedule daily sync check every minute
schedule.scheduleJob('* * * * *', async () => {
  try {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const dailyConfigs = await CompanyApiConfig.find({
      isActive: true,
      'syncSchedule.frequency': 'daily',
      'syncSchedule.timeOfDay': currentTime
    });

    for (const config of dailyConfigs) {
      try {
        await syncCompanyProducts(config._id);
      } catch (error) {
        console.error(`Failed to sync company ${config.company}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in daily sync:', error);
  }
}); 