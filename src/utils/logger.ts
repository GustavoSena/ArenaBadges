class Logger {
    verbose: boolean;
    constructor(verbose: boolean) {
        this.verbose = verbose;
    }

    setVerbose(verbose: boolean) {
        this.verbose = verbose;
    }

    log(message: string) {
        console.log(message);
    }
    
    error(message: string, error?: any) {
        console.error(message, error);
    }

    warn(message: string) {
        console.warn(message);
    }
    
    verboseLog(message: string, optionalMessage?: string) {
        if (this.verbose) {
            console.log(message);
        }
        else if (optionalMessage) {
            console.log(optionalMessage);
        }
    }
}

export function setVerbose(verbose: boolean) {
    logger.setVerbose(verbose);
}

const logger = new Logger(false);
export default logger;
