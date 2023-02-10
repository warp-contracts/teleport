import chalk from "chalk";

export function date() {
    return new Date().toUTCString();
}

export function error(message: string) {
    console.log(`[${chalk.gray(date())}] [${chalk.red("ERROR")}]: ${message}`)
}

export function info(message: string) {
    console.log(`[${chalk.gray(date())}] [${chalk.green("INFO")}]: ${message}`)
}

export function warn(message: string) {
    console.log(`[${chalk.gray(date())}] [${chalk.yellow("WARN")}]: ${message}`)
}