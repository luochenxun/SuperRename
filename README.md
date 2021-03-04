# SuperRename `[latest version: v1.0.1]`

SuperRename tool, can be used for folder organization of daily work , even software project renaming.

超级重命名工具，可用于平时工作文件夹整理，甚至是软件项目的重命名

```
version: 1.0.1
Usage: superRename [options] [command]

Options:
  -v, --version       output the current version （查看当前版本号）
  -h, --help          display help for command

Commands:
  install|i [module]  install one or more air-module （安装air模块）
  upgrade             脚本自动升级
  proj [dir]          给当前目录下的工程重命名
  project [dir]       给当前目录下的工程重命名
  help [command]      display help for command

运行 superRename -h | --help 查看命令使用。
```

## Install

```shell
sh -c "$(curl -fsSL https://raw.githubusercontent.com/luochenxun/SuperRename/master/install.sh)"
```
