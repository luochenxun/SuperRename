/**
 *
 * SuperRename cli 工具
 *
 * 命令行选项功能基于 Commander-js, 详情 => https://github.com/tj/commander.js/blob/master/Readme_zh-CN.md
 * 命令行交互功能基于 Inquirer.js, 详情 => https://github.com/SBoudrias/Inquirer.js, 示例文档：=> https://blog.csdn.net/qq_26733915/article/details/80461257
 */

// sys
import fs from 'fs'
import path from 'path'
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
// 3rd
import { Command } from 'commander'
import * as shelljs from 'shelljs'
import OraJS from 'ora'
import * as inquirer from 'inquirer'
import pkg from '../package.json'
// framework
import { DateUtil, StringUtil } from './base'


//#region [members]       全局定义

// 全局变量
const USER_HOME = process.env.HOME || process.env.USERPROFILE || '~'
const GLOBAL_DIR_NAME = '.' + pkg.name
const GLOBAL_DIR = path.join(USER_HOME, GLOBAL_DIR_NAME)
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_DIR, 'config.json')
const GLOBAL_REPOSITORY_DIR = path.join(GLOBAL_DIR, pkg.name)
const GLOBAL_REPOSITORY_PACKAGE = path.join(GLOBAL_REPOSITORY_DIR, 'package.json')
const PROJECT_DIR = shelljs.pwd().toString()
const ERROR_MSG = `${pkg.name} 更新失败，请重试或手动更新`;
const ROOT_TEMPLATE = 'http://git.luochenxun.com/SuperRename/root-templete.git';

// 新建 program 对象，全局命令行对象
const program = new Command(pkg.name)
const spinner = OraJS()

// ---- 接口、类型定义
interface Config {
  [cliName: string]: {
    version: string // 版本号
    lastUpgrade?: string // 上次更新日期
  }
}

//#endregion


//#region [main]          命令行基本信息

// 版本信息
program.addHelpText('before', `${pkg.description} \nversion: ${pkg.version}`);

// 版本号
program.version(pkg.version, '-v, --version', 'output the current version （查看当前版本号）');

// 作者

// 帮助
// program.on('--help', () => { })

// 使用示例
program.addHelpText('after', `
运行 ${pkg.name} -h | --help 查看命令使用。
`);

//#endregion


//#region [main] 主要方法 - renameProj

function renameProj() {

}

//#endregion


//#region [scaffold]      脚手架方法

const timeConsumingCmd = (cmd: string, tips: string = '处理中，请稍候'): Promise<{ code: number, stdout: string, stderr: string }> => {
  return new Promise((resolve, reject) => {
    spinner.start(tips)
    shelljs.exec(cmd, (code, stdout, stderr) => {
      spinner.stop()
      resolve({ code, stdout, stderr })
    })
  });
}

/** 自动升级 */
async function checkAndAutoUpgrade(force: boolean = false) {
  if (!force) {
    const toolsConfig = loadConfig()
    if (toolsConfig == null) {
      return;
    }
    const projectPackage = toolsConfig[pkg.name]

    const currentDate = DateUtil.currentDateStringWithFormat("yyyy-M-d");
    if (projectPackage.lastUpgrade == currentDate) {
      return;
    }
    console.log(`${pkg.name} 每日更新检查中，请稍等...`);

    // 更新全局配置
    const globalConfig = loadConfig() as Config
    globalConfig[pkg.name].lastUpgrade = DateUtil.currentDateStringWithFormat("yyyy-M-d");
    saveConfig(globalConfig)
  }

  await autoUpgrade()
}

async function autoUpgrade() {
  if (!shelljs.which('git')) {
    //在控制台输出内容
    shelljs.echo('本工具需要请安装 git，检查到系统尚未安装，请安装之.');
    shelljs.exit(1);
  }

  // 更新工具 git
  shelljs.cd(GLOBAL_DIR)
  if (fs.existsSync(GLOBAL_REPOSITORY_DIR)) { // 存在则进入目录，upgrade 之
    shelljs.cd(GLOBAL_REPOSITORY_DIR)
    await timeConsumingCmd(`git clean -df; git reset --hard HEAD 1>&- 2>&-`, '正在清理repository')
    await timeConsumingCmd(`git pull 1>&- 2>&-`, '正在拉取最新版本')
  } else { // 不存在则下载之
    if ((await timeConsumingCmd(`git clone ${pkg.repository.url} repository 1>&- 2>&-`, '正在拉取最新版本')).code !== 0) {
      shelljs.echo(ERROR_MSG);
      return;
    }
  }

  // 更新 git 成功则判断版本号是否需要升级
  if (!fs.existsSync(GLOBAL_REPOSITORY_PACKAGE)) { // 更新的命令文件不在
    shelljs.echo(ERROR_MSG);
    return
  }
  const toolsConfig = loadConfig(GLOBAL_REPOSITORY_PACKAGE);
  if (toolsConfig == null) {
    shelljs.rm('-rf', GLOBAL_REPOSITORY_DIR)
    return;
  }
  const projectPackage = toolsConfig[pkg.name]
  const versionOfNewGit = projectPackage.version
  if (versionOfNewGit == pkg.version) {
    // 版本相同不需要升级
    console.log('当前已是最新版本，无需要更新 ^_^');
    return;
  }

  // 有最新版本，更新之
  shelljs.cd(GLOBAL_REPOSITORY_DIR)
  const result = (await timeConsumingCmd(`npm install 1>&- 2>&-; npm run build 1>&- 2>&-; npm link 1>&- 2>&-`, `正在安装最新版 ${pkg.name}`)).code
  if (result == 0) {
    console.log('更新成功，当前最新版本：' + versionOfNewGit);
  } else {
    shelljs.echo(ERROR_MSG + `(code ${result})`);
  }

  shelljs.exit(0)
}

/** 读配置文件（如果不给地址，配置文件将默认存储在系统用户根目录） */
const loadConfig = (configPath?: string): Config | null => {
  let config: Config = {};
  config[pkg.name] = {
    version: pkg.version,
    lastUpgrade: DateUtil.currentDateStringWithFormat("yyyy-M-d")
  }

  if (configPath == undefined) {
    configPath = GLOBAL_CONFIG_PATH;
    // 配置路径不存在则新建之
    if (!fs.existsSync(GLOBAL_DIR)) {
      console.log('Create project global config dir => ', GLOBAL_DIR);
      fs.mkdirSync(GLOBAL_DIR)
    }
  } else if (!fs.existsSync(configPath)) {
    return null;
  }

  // 配置文件不存在则新建之
  if (!fs.existsSync(configPath)) {
    saveConfig(config)
  } else {
    const configBuff = fs.readFileSync(configPath);
    const configContent = configBuff && configBuff.toString()
    if (!StringUtil.isEmpty(configContent)) {
      config = JSON.parse(configContent);
    }
  }

  return config
}

/** 本地保存配置文件（如果不给地址，配置文件将默认存储在系统用户根目录） */
const saveConfig = (config: Config, configPath?: string): void => {
  if (configPath == undefined) {
    configPath = GLOBAL_CONFIG_PATH;
    // 配置路径不存在则新建之
    if (!fs.existsSync(GLOBAL_DIR)) {
      console.log('Create project global config dir => ', GLOBAL_DIR);
      fs.mkdirSync(GLOBAL_DIR)
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, "\t"))
}

//#endregion


//#region [sub] command - 导入外部命令

program
  .command('install [module]', 'install one or more air-module （安装air模块）').alias('i')

//#endregion


//#region [sub] command - AutoUpgrade

program
  .command('upgrade')
  .description('脚本自动升级')
  .action(() => {
    checkAndAutoUpgrade()
  })

//#endregion


//#region [sub] command - Project

program
  .command('proj')
  .description('初始化 SuperRename 项目')
  .action(() => {
    renameProj()
  })

program
  .command('project')
  .description('初始化 SuperRename 项目')
  .action(() => {
    renameProj()
  })

//#endregion


//#region [interface]     定义及处理参数

async function main() {
  await checkAndAutoUpgrade()
  shelljs.cd(PROJECT_DIR)
  program.parse(process.argv)
}

//#endregion


main()
