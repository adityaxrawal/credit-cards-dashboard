import winston from 'winston';
import { env } from '../../config/env';

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const level = () => {
    const envLevel = env.NODE_ENV || 'development';
    return envLevel === 'development' ? 'debug' : 'warn';
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    // Add errors stack trace
    winston.format.errors({ stack: true }),
    // Splat for string interpolation
    winston.format.splat(),
    winston.format.json()
);

const devFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => {
            const { timestamp, level, message, ...meta } = info;
            const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} ${level}: ${message} ${metaString}`;
        },
    ),
);

const selectedFormat = env.NODE_ENV === 'development' ? devFormat : format;

const transports = [
    new winston.transports.Console(),
    new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
    }),
    new winston.transports.File({ filename: 'logs/all.log' }),
];

const logger = winston.createLogger({
    level: level(),
    levels,
    format: selectedFormat,
    transports,
});

export default logger;
