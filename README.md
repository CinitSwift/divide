# 游戏分队平台

一个基于微信小程序的游戏分队平台，支持创建房间、邀请好友、随机分边等功能。

## 技术栈

### 后端
- Node.js + NestJS
- TypeScript
- MySQL + Redis
- WebSocket (Socket.IO)
- JWT 认证

### 前端
- 微信小程序原生开发
- TypeScript

## 项目结构

```
├── server/                 # 后端项目
│   ├── src/
│   │   ├── common/         # 公共模块
│   │   ├── config/         # 配置
│   │   └── modules/        # 业务模块
│   │       ├── auth/       # 认证模块
│   │       ├── user/       # 用户模块
│   │       ├── room/       # 房间模块
│   │       └── wechat/     # 微信服务
│   └── package.json
│
└── miniprogram/            # 小程序前端
    ├── pages/              # 页面
    │   ├── login/          # 登录页
    │   ├── index/          # 首页
    │   ├── create-room/    # 创建房间
    │   ├── room/           # 房间详情
    │   └── result/         # 分边结果
    ├── services/           # API 服务
    ├── utils/              # 工具类
    └── app.json
```

## 快速开始

### 后端

1. 安装依赖
```bash
cd server
npm install
```

2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填入数据库和微信配置
```

3. 启动开发服务器
```bash
npm run start:dev
```

### 前端

1. 使用微信开发者工具打开项目根目录
2. 在 `project.config.json` 中填入你的小程序 AppID
3. 在 `miniprogram/utils/request.ts` 中配置后端 API 地址

## API 接口

### 认证模块
- `POST /api/auth/login` - 微信登录
- `GET /api/auth/profile` - 获取用户信息

### 房间模块
- `POST /api/room/create` - 创建房间
- `GET /api/room/:roomCode` - 获取房间详情
- `POST /api/room/:roomCode/join` - 加入房间
- `POST /api/room/:roomCode/leave` - 离开房间
- `DELETE /api/room/:roomCode` - 关闭房间
- `POST /api/room/:roomCode/divide` - 开始分边
- `POST /api/room/:roomCode/redivide` - 重新分边
- `GET /api/room/:roomCode/result` - 获取分边结果

## 功能特性

- ✅ 微信一键登录
- ✅ 创建/加入房间
- ✅ 房间成员实时同步
- ✅ Fisher-Yates 随机分边算法
- ✅ 重新分边
- ✅ 分享邀请好友
- ✅ 复制房间号

## License

MIT
