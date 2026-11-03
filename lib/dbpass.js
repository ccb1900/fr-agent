// lib/dbpass.js — 数据库凭据单源加载（凭据不入仓库）
// 真密码只放本机 data/db_local.js（.gitignore 忽略）；克隆本仓库后须自建该文件：
//   文件末行为 Nashorn 对象字面量，如： ({ user: 'sa', password: '真密码' })
// 用法（Nashorn）：load('D:/fineagent/lib/dbpass.js') -> password 字符串
var _cred = load('D:/fineagent/data/db_local.js');
if (!_cred || !_cred.user || !_cred.password) {
  throw '缺本机凭据 data/db_local.js（不入库）。自建：({user:\'sa\', password:\'真密码\'})，密码含特殊字符按 URL userinfo 规则编码';
}
_cred.password
