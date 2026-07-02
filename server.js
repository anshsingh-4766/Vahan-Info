require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/logger');
const { PORT } = require('./src/config');

app.listen(PORT, () => logger.info(`Server running at http://localhost:${PORT}`));
