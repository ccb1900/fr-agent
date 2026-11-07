# -*- coding: utf-8 -*-
"""verify/stage3_final_check.py — 阶段 3.1+3.2 验收唯一验证入口（基线 main@a82e8ba）。

用法（工作区根目录）：
    py verify/stage3_final_check.py            # 全量（含负门/双 e2e 重门）
    py verify/stage3_final_check.py --no-heavy # 跳过负门与真实引擎 E2E（快速迭代）

把任务书"用户已给的标准 1-10"逐条变成检查。检查分两类：
  A. 真实故障注入（沙盒黑盒）：构造真实 run 目录 + patch.json/manifest/staging，
     用真实子进程跑 agent/tools/fr_agent.ps1 promote/restore，断言拒绝/自愈/字节不变。
     沙盒 = FR_AGENT_HOME/FR_HOME/FR_AGENT_RUNTIME_DIR/FR_AGENT_MUTEX 全重定向，
     真实部署目录只读、绝不写入（每个反例都断言部署件字节不变）。
  B. 跑命令/读真实产物：fast15、静态门、scan、负门、双 e2e、基线 MD5、git 状态、文档留痕；
     JS 纯函数合同（regression.js/diff.js）经 Nashorn 子进程跑（临时脚本 ASCII-only）。

三态：PASS / FAIL / BLOCKED（环境不可用或不可确定性注入，如实标注）/ NOT RUN（--no-heavy 跳过）。
退出码：存在 FAIL -> 1；否则 0。
本验证器只读被测代码、只在 logs/（gitignore 区）落盘，重复运行幂等。
"""
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SBX = os.path.join(ROOT, "logs", "stage3_verify_sbx")
AGENT = os.path.join(ROOT, "agent", "tools", "fr_agent.ps1")
FR_REAL = r"D:\software\FineReport_11.0"
JAVA = os.path.join(FR_REAL, "jre", "bin", "java.exe")
NASHORN = os.path.join(FR_REAL, "jre", "lib", "ext", "nashorn.jar")
BASELINE_MD5 = "CBEB42E3CE48E46E362B9AE80168026F"
HEAVY = "--no-heavy" not in sys.argv

# 门禁自产件白名单（S0 语义，2026-11-07 本轮实证后明确）：S9f/S9g1/S9g2 门禁按产品设计会把【它们自己
# create 的报表】部署进真实部署目录（create→promote 是真实部署链，是被测产品行为，不是验证器越权写）。
# 实测（logs/inv_before-after 对拍，一次 c-maturity e2e）：cpt/pdf 内嵌创建时间戳逐跑字节不同（png 像素
# 确定性不变），被改写的 5 个文件全部属于下列门禁自产件名单。S0 的安全线因此定为：
#   ① 既有文件一个都不能丢；② 发生变化/新增的文件必须属于本名单；名单之外任何字节变化 = FAIL。
# 这正是"不丢生产件的验证器侧铁证"——验证器与沙盒用例本身仍全程只读真实部署目录。
GATE_ARTIFACT_PREFIXES = (
    "工单参数查询C_api.",    # c-maturity C1（verify/fixtures/c_maturity/c1_params_hl.json）
    "车间双页日报C_api.",    # c-maturity C2（c2_multisheet_hf.json）
    "生产日报图C_api.",      # c-maturity C3（c3_chart_intent.json）
    "生产日报GOLDEN_api.",   # golden e2e（logs/agent/golden/g1_intent.json）
    "neg_secret_leak_api.",  # 引擎负门 secret-leak 夹具（deploy 后撤回，pdf/png 残留为门禁自产件）
    "销售明细_api.",         # make_api 默认 spec（销售明细/reports/sales_demo）的部署产物——每轮门禁
                             #   末步默认 spec 收尾都会重写：cpt 确定性字节不变、png 钉 A8EF39AB（fast_baseline
                             #   钉住部署件语义面）、pdf 内嵌时间戳逐跑不同（本轮全量终验 S0 实测唯一 stray）
)

RESULTS = []


def rec(cid, name, state, detail=""):
    RESULTS.append({"id": cid, "name": name, "state": state, "detail": detail})
    print("[%s] %s :: %s" % (state, cid, name))
    if detail:
        print("       " + str(detail).replace("\n", " ")[:600])


def read(p, binary=False):
    try:
        with open(p, "rb" if binary else "r", encoding=None if binary else "utf-8-sig") as f:
            return f.read()
    except OSError:
        return None


def sha256(p):
    import hashlib
    d = read(p, binary=True)
    return hashlib.sha256(d).hexdigest().upper() if d is not None else None


def md5(p):
    import hashlib
    d = read(p, binary=True)
    return hashlib.md5(d).hexdigest().upper() if d is not None else None


def sh(args, timeout=120, env=None):
    e = dict(os.environ)
    if env:
        e.update({k: str(v) for k, v in env.items()})
    try:
        p = subprocess.run(args, capture_output=True, timeout=timeout, env=e, cwd=ROOT)
        return p.returncode, (p.stdout or b"").decode("utf-8", "replace"), (p.stderr or b"").decode("utf-8", "replace")
    except subprocess.TimeoutExpired as t:
        out = (t.stdout or b"").decode("utf-8", "replace") if t.stdout else ""
        return None, out, "TIMEOUT after %ss" % timeout


def run_agent(verb, rid, timeout=120):
    env = {
        "FR_AGENT_HOME": os.path.join(SBX, "root"),
        "FR_HOME": os.path.join(SBX, "fr"),
        "FR_AGENT_RUNTIME_DIR": os.path.join(SBX, "rt"),
        "FR_AGENT_MUTEX": "fr-agent-mtx-stage3-verify-%d" % os.getpid(),
    }
    return sh(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
               "-File", AGENT, "-Verb", verb, "-RunId", rid], timeout=timeout, env=env)


def read_json(p):
    t = read(p)
    if t is None:
        return None
    try:
        return json.loads(t)
    except ValueError:
        return None


def write(p, text):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def run_js(js_body, tag, timeout=90):
    """Nashorn 跑一段 ASCII-only JS，返回 (rc, stdout, stderr)。java 缺失返回 (None,'','java missing')。"""
    if not os.path.isfile(JAVA):
        return None, "", "java not found"
    p = os.path.join(SBX, "js_%s_%d.js" % (tag, abs(hash(js_body)) % 10 ** 9))
    write(p, js_body)
    return sh([JAVA, "-cp", NASHORN, "jdk.nashorn.tools.Shell", p], timeout=timeout)


# ---------------- 沙盒与 case 构造（黑盒注入的舞台） ----------------

def fresh_sandbox():
    if os.path.isdir(SBX):
        shutil.rmtree(SBX, ignore_errors=True)
    for d in [os.path.join(SBX, "root", "logs", "agent", "runs"),
              os.path.join(SBX, "rt"),
              os.path.join(SBX, "fr", "webapps", "webroot", "WEB-INF", "reportlets", "fineagent")]:
        os.makedirs(d, exist_ok=True)
    sbx_deploy = os.path.join(SBX, "fr", "webapps", "webroot", "WEB-INF", "reportlets", "fineagent")
    real_deploy = os.path.join(FR_REAL, "webapps", "webroot", "WEB-INF", "reportlets", "fineagent")
    if os.path.abspath(sbx_deploy) == os.path.abspath(real_deploy):
        print("ABORT: sandbox deploy dir == real deploy dir")
        sys.exit(2)


DEPLOY = os.path.join(SBX, "fr", "webapps", "webroot", "WEB-INF", "reportlets", "fineagent")
_seq = [0]


def new_case(tag, src_text):
    _seq[0] += 1
    rid = "s3v%02d%s" % (_seq[0], tag)
    run_dir = os.path.join(SBX, "root", "logs", "agent", "runs", rid)
    staging = os.path.join(run_dir, "staging")
    os.makedirs(staging, exist_ok=True)
    cpt = "mart_%02d.cpt" % _seq[0]
    deployed = os.path.join(DEPLOY, cpt)
    write(deployed, src_text)
    patch_rel = "logs/agent/runs/%s/patch_e2e.json" % rid
    spec = json.dumps({"patchVersion": "1", "sourceCpt": "fineagent/" + cpt, "outName": "MTX",
                       "ops": [{"op": "replace_cell_value", "sheet": 0, "cell": {"c": 0, "r": 0},
                                "value": {"kind": "text", "text": "MTX"}}]})
    write(os.path.join(run_dir, "patch_e2e.json"), spec)
    c = {"rid": rid, "runDir": run_dir, "staging": staging, "deployed": deployed, "cpt": cpt,
         "patchRel": patch_rel, "orig": os.path.join(staging, cpt.replace(".cpt", ".orig.cpt")),
         "patched": os.path.join(staging, cpt)}
    write(c["orig"], src_text)
    return c


def manifest_for(c, source_hash, **over):
    mf = {"sourceCpt": "fineagent/" + c["cpt"], "out": c["patched"], "ops": 1, "namedStyles": 0,
          "diffClean": True, "added": [], "removed": [], "structDelta": 0,
          "execution": {"pass": True, "reason": "ok"}, "render": {"pass": True, "reason": "ok"},
          "datasetChecks": [{"where": "in-memory", "pass": True, "reason": "ok"}],
          "datasetOps": 1, "sourceHash": source_hash}
    mf.update(over)
    return mf


def stage_patch(c, mf_embedded, mf_disk=None, ok=True, staging_dir=None, staged_text=None):
    """写 staged patched 文件（落在 mf.out 指向处）+ patch.json（内嵌 manifest）+ 磁盘 manifest.json。"""
    out_path = mf_embedded.get("out") or c["patched"]
    write(out_path, staged_text or ("PATCHED-" + c["rid"] + "y" * 400))
    staging_dir = staging_dir or c["staging"]
    pj = {"tool": "patch", "runId": c["rid"], "ok": ok, "patch": c["patchRel"],
          "stagingDir": staging_dir, "manifestPath": os.path.join(staging_dir, "manifest.json"),
          "manifest": mf_embedded}
    write(os.path.join(c["runDir"], "patch.json"), json.dumps(pj))
    write(os.path.join(staging_dir, "manifest.json"), json.dumps(mf_disk if mf_disk is not None else mf_embedded))
    c["patched"] = out_path


def art_state(c, verb):
    return read_json(os.path.join(c["runDir"], verb + ".json"))


def refused(cid, name, c, verb, inv, needle, hash_before):
    """断言一次调用被拒：exit 1 + json ok=false + 部署件字节不变；needle 次级（错误必须指向原因）。"""
    a = art_state(c, verb)
    txt = (inv[1] or "") + (inv[2] or "")
    if inv[0] != 1:
        rec(cid, name, "FAIL", "exit=%s (expect 1) out=%s" % (inv[0], txt[:300]))
        return
    if not a or a.get("ok") is not False:
        rec(cid, name, "FAIL", "%s.json missing or ok!=false" % verb)
        return
    if sha256(c["deployed"]) != hash_before:
        rec(cid, name, "FAIL", "deployed file bytes changed by the REFUSED operation (fail-open!)")
        return
    if needle and not re.search(needle, str(a.get("error", ""))):
        rec(cid, name, "FAIL", "refused but error misses needle %r; error=%r" % (needle, str(a.get("error"))[:300]))
        return
    rec(cid, name, "PASS", "refused, deployed bytes intact, error=%r" % str(a.get("error"))[:160])


# ---------------- 标准检查 ----------------

def s1_manifest_full_consistency():
    """标准1（3.1-1 P1）：promote 磁盘 manifest.json 与内嵌 manifest 完整一致校验，
    覆盖 execution/render/datasetChecks；篡改内嵌 execution.pass 的反例被拒。"""
    if not os.path.isfile(AGENT):
        rec("S1", "3.1-1 manifest 完整一致", "BLOCKED", "fr_agent.ps1 missing")
        return
    # 反例 a：内嵌 execution.pass=true 而磁盘 false（四字段比对看不见的篡改点）
    c = new_case("A", "ORIG-S1A" + "x" * 400)
    h0 = sha256(c["deployed"])
    emb = manifest_for(c, h0)
    disk = json.loads(json.dumps(emb))
    disk["execution"] = {"pass": False, "reason": "grid changed unexpectedly"}
    stage_patch(c, emb, disk)
    refused("S1a", "内嵌 execution.pass=true / 磁盘 false -> 拒", c, "promote", run_agent("promote", c["rid"]),
            r"EVIDENCE|MISMATCH|disagree|manifest|MANIFEST", h0)
    # 反例 b：render.pass 篡改
    c = new_case("B", "ORIG-S1B" + "x" * 400)
    h0 = sha256(c["deployed"])
    emb = manifest_for(c, h0)
    disk = json.loads(json.dumps(emb))
    disk["render"] = {"pass": False, "reason": "pixel diff over threshold"}
    stage_patch(c, emb, disk)
    refused("S1b", "内嵌 render.pass=true / 磁盘 false -> 拒", c, "promote", run_agent("promote", c["rid"]),
            r"EVIDENCE|MISMATCH|disagree|manifest|MANIFEST", h0)
    # 反例 c：datasetChecks 篡改
    c = new_case("C", "ORIG-S1C" + "x" * 400)
    h0 = sha256(c["deployed"])
    emb = manifest_for(c, h0)
    disk = json.loads(json.dumps(emb))
    disk["datasetChecks"] = [{"where": "in-memory", "pass": False, "reason": "col mismatch"}]
    stage_patch(c, emb, disk)
    refused("S1c", "内嵌 datasetChecks pass / 磁盘 fail -> 拒", c, "promote", run_agent("promote", c["rid"]),
            r"EVIDENCE|MISMATCH|disagree|manifest|MANIFEST|dataset", h0)
    # 正对照：磁盘与内嵌完全一致 -> 不因 manifest 校验被拒，全链 promote 成功且字节落位
    c = new_case("D", "ORIG-S1D" + "x" * 400)
    h0 = sha256(c["deployed"])
    stage_patch(c, manifest_for(c, h0))
    inv = run_agent("promote", c["rid"])
    a = art_state(c, "promote")
    now = sha256(c["deployed"])
    staged = sha256(c["patched"])
    if inv[0] != 0 or not a or a.get("ok") is not True:
        err = str(a.get("error")) if a else (inv[1] or "")
        rec("S1d", "一致 manifest 正对照 -> promote 成功", "FAIL", "rc=%s error=%s" % (inv[0], err[:300]))
    elif now != staged:
        rec("S1d", "一致 manifest 正对照 -> promote 成功", "FAIL", "deployed bytes != staged patched bytes")
    elif not a.get("deployedHash") or not a.get("promotedHash") or not a.get("sourceHash"):
        rec("S1d", "一致 manifest 正对照 -> promote 成功", "FAIL", "promote.json missing hash chain fields")
    else:
        rec("S1d", "一致 manifest 正对照 -> promote 成功", "PASS", "hash chain recorded")


def s2_staging_runid_binding():
    """标准2（3.1-2 P1）：staging 根绑定当前 RunId；patch.json.stagingDir 指向其它 RunId 的 staging -> 拒。"""
    host = new_case("H", "ORIG-S2H" + "x" * 400)  # 供越权者指向的“别的 RunId”的 staging
    c = new_case("X", "ORIG-S2X" + "x" * 400)
    h0 = sha256(c["deployed"])
    # staged 与 .orig 都放在 host 的 staging（内容自洽合法），stagingDir 自声明指向 host —— 必须被 RunId 绑定拒绝
    emb = manifest_for(c, h0)
    emb["out"] = os.path.join(host["staging"], "evil_from_other_run.cpt")
    evil_txt = "PATCHED-EVIL-BY-RUN-" + c["rid"]
    stage_patch(c, emb, None, staging_dir=host["staging"], staged_text=evil_txt)
    write(os.path.join(host["staging"], c["cpt"].replace(".cpt", ".orig.cpt")), "ORIG-S2X" + "x" * 400)
    refused("S2a", "patch.json.stagingDir 指向其它 RunId staging -> 拒", c, "promote", run_agent("promote", c["rid"]),
            r"staging|RunId|RUNID|MISMATCH|bind", h0)
    # 正对照：staging = 本 RunId 自身 staging -> 不因绑定被拒
    c = new_case("Y", "ORIG-S2Y" + "x" * 400)
    h0 = sha256(c["deployed"])
    stage_patch(c, manifest_for(c, h0))
    inv = run_agent("promote", c["rid"])
    a = art_state(c, "promote")
    if inv[0] != 0 or not a or a.get("ok") is not True:
        err = str(a.get("error")) if a else (inv[1] or "")
        rec("S2b", "本 RunId staging 正对照 -> promote 成功", "FAIL", "rc=%s error=%s" % (inv[0], err[:300]))
    else:
        rec("S2b", "本 RunId staging 正对照 -> promote 成功", "PASS", "")


def s3_crash_consistency():
    """标准3（3.1-3 P1）：PREPARED/COMMITTED 部署操作日志 + 崩溃后 promote/restore 按实际哈希识别并恢复。"""
    txt = (read(AGENT) or "") + (read(os.path.join(ROOT, "agent", "tools", "_deploy.ps1")) or "")
    has_log = ("PREPARED" in txt) and ("COMMITTED" in txt)
    rec("S3a", "PREPARED/COMMITTED 部署操作日志落地", "PASS" if has_log else "FAIL",
        "" if has_log else "fr_agent.ps1/_deploy.ps1 无 PREPARED/COMMITTED 记录")

    # promote 崩溃恢复：真 promote 成功后截断 promote.json（= 第2步替换成功、第4步提交未完成的崩溃后果），
    # 下次 promote 重试必须按实际部署件哈希识别（部署件=预期 promoted 字节）并恢复一致，不假绿也不死锁。
    c = new_case("P", "ORIG-S3P" + "x" * 400)
    h_src = sha256(c["deployed"])
    stage_patch(c, manifest_for(c, h_src))
    inv = run_agent("promote", c["rid"])
    a1 = art_state(c, "promote")
    if inv[0] != 0 or not a1 or a1.get("ok") is not True:
        rec("S3b", "promote 崩溃后恢复（前置：正常 promote）", "FAIL", "pre-step promote rc=%s %s" % (inv[0], (inv[1] or "")[:200]))
    else:
        h_promoted = sha256(c["deployed"])  # = staged 字节
        os.remove(os.path.join(c["runDir"], "promote.json"))  # 崩溃截断（真实 PREPARED/COMMITTED 留在盘上）
        inv2 = run_agent("promote", c["rid"])
        a2 = art_state(c, "promote")
        h_now = sha256(c["deployed"])
        if h_now not in (h_src, h_promoted):
            rec("S3b", "promote 崩溃后恢复", "FAIL", "deployed bytes corrupted by recovery: %s" % h_now)
        elif a2 and a2.get("ok") is True and h_now == h_promoted:
            rec("S3b", "promote 崩溃后恢复（识别未提交 -> 完成提交）", "PASS", "")
        elif a2 and a2.get("ok") is False and re.search(r"PREPARED|UNCOMMITTED|recover|incomplete|unfinished", str(a2.get("error", "")), re.I):
            inv3 = run_agent("restore", c["rid"])
            a3 = art_state(c, "restore")
            if inv3[0] == 0 and a3 and a3.get("ok") is True and sha256(c["deployed"]) == h_src:
                rec("S3b", "promote 崩溃后恢复（识别 -> restore 回退成功）", "PASS", "")
            else:
                rec("S3b", "promote 崩溃后恢复", "FAIL", "recovery hint given but restore failed: rc=%s err=%s" % (inv3[0], (a3 or {}).get("error")))
        else:
            rec("S3b", "promote 崩溃后恢复", "FAIL",
                "retry neither completed nor diagnosed the uncommitted swap; promote.json=%s" % json.dumps(a2)[:300])

    # restore 崩溃恢复：restore 成功后截断 restore.json，重试必须按实际哈希（部署件=orig 字节）识别并补记录。
    c = new_case("R", "ORIG-S3R" + "x" * 400)
    h_src = sha256(c["deployed"])
    stage_patch(c, manifest_for(c, h_src))
    inv = run_agent("promote", c["rid"])
    if inv[0] != 0:
        rec("S3c", "restore 崩溃后恢复（前置：promote）", "FAIL", "promote rc=%s" % inv[0])
        return
    inv = run_agent("restore", c["rid"])
    a1 = art_state(c, "restore")
    if inv[0] != 0 or not a1 or a1.get("ok") is not True:
        rec("S3c", "restore 崩溃后恢复（前置：restore）", "FAIL", "restore rc=%s %s" % (inv[0], (inv[1] or "")[:200]))
        return
    h_restored = sha256(c["deployed"])  # = orig 字节
    os.remove(os.path.join(c["runDir"], "restore.json"))  # 崩溃截断
    inv2 = run_agent("restore", c["rid"])
    a2 = art_state(c, "restore")
    h_now = sha256(c["deployed"])
    if h_now != h_restored:
        rec("S3c", "restore 崩溃后恢复", "FAIL", "deployed bytes changed by recovery retry")
    elif a2 and a2.get("ok") is True:
        rec("S3c", "restore 崩溃后恢复（识别已替换 -> 补提交）", "PASS", "")
    else:
        rec("S3c", "restore 崩溃后恢复", "FAIL", "retry did not recognize the completed restore; restore.json=%s" % json.dumps(a2)[:300])

    # 真 kill 进程变体不可确定性注入（替换->提交窗口毫秒级、无代码钩子），如实标注：
    rec("S3d", "真进程 kill 崩溃注入", "BLOCKED",
        "File.Replace->WriteAtomic 窗口毫秒级且黑盒无确定性注入点；以上 S3b/S3c 为真实操作日志+截断提交物的确定性等价注入（标准原文即'模拟崩溃'）")


def s4_concurrency_boundary():
    """标准4（3.1-4）：协作边界声明写入 promote.json 与文档；并发窗口故障测试有结论。"""
    c = new_case("K", "ORIG-S4K" + "x" * 400)
    stage_patch(c, manifest_for(c, sha256(c["deployed"])))
    run_agent("promote", c["rid"])
    pj = art_state(c, "promote")
    pj_txt = json.dumps(pj) if pj else ""
    if pj and pj.get("ok") is True and re.search(r"concurr|boundary|mutex|协作", pj_txt, re.I):
        rec("S4a", "promote.json 携带协作边界声明", "PASS", "")
    elif pj and pj.get("ok") is True:
        rec("S4a", "promote.json 携带协作边界声明", "FAIL", "promote.json has no concurrency/boundary field: %s" % pj_txt[:400])
    else:
        rec("S4a", "promote.json 携带协作边界声明", "FAIL", "promote did not succeed to produce the artifact")
    doc_lines = []
    for p in ["docs/architecture/runtime-supervisor.md", "docs/night-shift-log.md", "README.md",
              "docs/architecture/capability-matrix.md", "docs/architecture/coverage.md"]:
        fp = os.path.join(ROOT, p)
        t = read(fp) or ""
        doc_lines += ["%s:%s" % (p, l) for l in t.splitlines()]
    # 必须是【部署窗口】语境的声明：并发词与 promote/部署/替换 共现（RunId 登记语境不算）
    hit = [l for l in doc_lines
           if re.search(r"check-then-act|TOCTOU|并发窗口|协作边界|cooperating", l, re.I)
           and re.search(r"promote|restore|部署|deploy|File\.Replace|替换", l, re.I)]
    if hit:
        rec("S4b", "文档含 promote 部署窗口的协作边界声明", "PASS", hit[0][:200])
    else:
        rec("S4b", "文档含 promote 部署窗口的协作边界声明", "FAIL",
            "concurrency wording only in RunId-registration context, not the promote swap window")
    ver = ""
    for p in ["docs/night-shift-log.md", "docs/gpt"]:
        fp = os.path.join(ROOT, p)
        if os.path.isfile(fp):
            ver += read(fp) or ""
        elif os.path.isdir(fp):
            for n in sorted(os.listdir(fp)):
                ver += read(os.path.join(fp, n)) or ""
    if re.search(r"并发窗口|check-then-act|concurrency window", ver, re.I) and re.search(r"PASS|BLOCKED|NOT RUN", ver):
        rec("S4c", "并发窗口故障测试有结论（注入或 BLOCKED 留痕）", "PASS", "")
    else:
        rec("S4c", "并发窗口故障测试有结论（注入或 BLOCKED 留痕）", "FAIL", "no documented concurrency-window test verdict")


JS_S5 = (
    "load('D:/fineagent/template/regression.js');\n"
    "var before = {ok:true, rows:[['Header','d1'],['Val','1']], error:null};\n"
    "var after  = {ok:true, rows:[['HeaderTampered','d1'],['Val','1']], error:null};\n"
    "var ex = TemplateRegression.execution(before, after, {hasDatasetOp:true});\n"
    "var ds = TemplateRegression.dataset({columns:[{name:'a',type:'integer'}],rows:[[7]]},\n"
    "                                    {ok:true,columns:[{name:'a',type:'integer'}],rows:[['7']]});\n"
    "print('S5=' + JSON.stringify({execPass: ex.pass, execReason: ex.reason, dsPass: ds.pass}));\n"
)

JS_S6 = (
    "load('D:/fineagent/template/diff.js');\n"
    "var b='<R><TableData name=\"ds1\"><![CDATA[SELECT a FROM t]]></TableData><O c=\"0\"><![CDATA[budget>100$, ok]]></O></R>';\n"
    "var a='<R><TableData name=\"ds1\"><![CDATA[SELECT x FROM y]]></TableData><O c=\"0\"><![CDATA[budget>999$, ok]]></O></R>';\n"
    "var d=TemplateDiff.diff(b,a,{ops:[{op:'replace_dataset'}]});\n"
    "var b2='<R><TableData name=\"ds1\"><![CDATA[SELECT a FROM t]]></TableData><O c=\"0\"><![CDATA[Title]]></O></R>';\n"
    "var a2='<R><TableData name=\"ds1\"><![CDATA[9o_4H\"a,.c^2%s,WQW>n\"5qO+rF8D\\nnPFc3*]A@OAMb!_oT--5?@$!m0WeK\\n]]></TableData><O c=\"0\"><![CDATA[Title]]></O></R>';\n"
    "var d2=TemplateDiff.diff(b2,a2,{ops:[{op:'replace_dataset'}]});\n"
    "print('S6=' + JSON.stringify({clean:d.clean, add:d.unintended.added, rem:d.unintended.removed, clean2:d2.clean}));\n"
)

JS_S7B = (
    "load('D:/fineagent/template/regression.js');\n"
    "var r = TemplateRegression.execution({ok:true,rows:[['a'],['b']],error:null},{ok:true,rows:[['a']],error:null},{});\n"
    "print('S7B=' + (r.pass === false ? 'PASS' : 'FAIL') + ' reason=' + r.reason);\n"
)


def s5_execution_regression_split():
    """标准5（3.2-1 P1）：replace_dataset 不再跳过执行栅格回归；dataset/execution 双判定独立。"""
    src = read(os.path.join(ROOT, "template", "regression.js")) or ""
    if re.search(r"if\s*\(\s*opts\.hasDatasetOp\s*\)\s*return\s*\{\s*pass:\s*true", src):
        rec("S5a", "regression.js 无 hasDatasetOp 直接 pass 短路", "FAIL", "regression.js 的 hasDatasetOp 短路仍在")
    else:
        rec("S5a", "regression.js 无 hasDatasetOp 直接 pass 短路", "PASS", "")
    rc, out, err = run_js(JS_S5, "s5")
    m = re.search(r"S5=(\{.*\})", out) if out else None
    if rc is None:
        rec("S5b", "执行栅格反例（绑定被改必须 FAIL）", "BLOCKED", err[:200])
        rec("S5c", "dataset integrity 判定保持", "BLOCKED", err[:200])
    elif not m:
        rec("S5b", "执行栅格反例（绑定被改必须 FAIL）", "BLOCKED", "no output: " + (out + err)[:200])
    else:
        r = json.loads(m.group(1))
        rec("S5b", "hasDatasetOp 下非数据区格被改 -> FAIL", "PASS" if r["execPass"] is False else "FAIL",
            "reason=%r" % r.get("execReason", ""))
        rec("S5c", "dataset integrity 判定保持（正确读回 PASS）", "PASS" if r["dsPass"] is True else "FAIL", "")
    pm = read(os.path.join(ROOT, "template", "patch_main.js")) or ""
    ok_pm = ("execution" in pm) and ("datasetChecks" in pm)
    rec("S5d", "patch_main.js manifest 含独立 execution/datasetChecks 判定", "PASS" if ok_pm else "FAIL", "")


def s6_diff_node_context():
    """标准6（3.2-2 P2）：diff 数据集豁免按 XML 节点上下文；含 >/$ 的普通单元格文本不误豁免。"""
    rc, out, err = run_js(JS_S6, "s6")
    m = re.search(r"S6=(\{.*\})", out) if out else None
    if rc is None:
        rec("S6", "diff 节点上下文豁免", "BLOCKED", err[:200])
        return
    if not m:
        rec("S6", "diff 节点上下文豁免", "BLOCKED", "no output: " + (out + err)[:200])
        return
    r = json.loads(m.group(1))
    leaked = (r["add"] or []) + (r["rem"] or [])
    good = r["clean"] is False and any("budget" in t for t in leaked)
    rec("S6a", "含 >/$ 的普通单元格文本变化不被豁免", "PASS" if good else "FAIL",
        "clean=%s unintended=%s" % (r["clean"], json.dumps(leaked)[:200]))
    rec("S6b", "TableData 节点内数据集本体串仍豁免（不回归）", "PASS" if r["clean2"] is True else "FAIL", "")


def s7_coordinate_mapping_evidence():
    """标准7（3.2-3 P2）：坐标映射经真引擎探针定案并留证；留证缺失即 FAIL。
    留证必须是【本轮】产物：基线 a82e8ba 之后 git 新增的探针/模板文件，或日志本轮条目中的映射结论。"""
    rc, names, _ = sh(["git", "log", "--diff-filter=A", "--name-only", "--pretty=format:",
                       "a82e8ba..HEAD", "--", "probes/", "template/", "verify/"], 30)
    new_files = [] if rc != 0 else [n.strip() for n in names.splitlines()
                                    if n.strip() and re.search(r"coord|map|expand|rowspan", n, re.I)]
    log = read(os.path.join(ROOT, "docs", "night-shift-log.md")) or ""
    # 本轮条目段 = 本轮编号字样（历史条目未用过 3.2-3 编号）之后的内容
    m = re.search(r"3\.2-3", log)
    log_hit = bool(m) and re.search(r"坐标映射|执行栅格坐标|映射规律|coordinate", log[m.start():], re.I)
    if new_files or log_hit:
        rec("S7a", "坐标映射探针/结论【本轮】留证存在", "PASS", "newProbes=%s logHit=%s" % (new_files[:3], bool(log_hit)))
    else:
        rec("S7a", "坐标映射探针/结论【本轮】留证存在", "FAIL",
            "no new probe/impl file since a82e8ba, no 3.2-3 conclusion in night-shift-log")
    rc, out, err = run_js(JS_S7B, "s7")
    m = re.search(r"S7B=(PASS|FAIL)", out) if out else None
    if rc is None:
        rec("S7b", "执行栅格行数变化仍保守拒（映射未定案不放宽）", "BLOCKED", err[:200])
    elif not m:
        rec("S7b", "执行栅格行数变化仍保守拒", "BLOCKED", "no output: " + (out + err)[:200])
    else:
        rec("S7b", "执行栅格行数变化仍保守拒（映射未定案不放宽）", m.group(1), "")


def s8_engine_launch_handle():
    """标准8（3.2-4 P2）：engine_launch Handle 获取失败进入明确失败路径，不再静默空吞。"""
    src = read(os.path.join(ROOT, "engine_launch.ps1")) or ""
    if re.search(r"\$p\.Handle[^}]*\}\s*catch\s*\{\s*\}", src):
        rec("S8a", "Handle 获取失败不再空吞（catch 有明确动作）", "FAIL", "engine_launch.ps1 仍存在 try{$p.Handle}catch{}")
    elif re.search(r"Handle[^}]*\}\s*catch\s*\{[^}]+\}", src):
        rec("S8a", "Handle 获取失败不再空吞（catch 有明确动作）", "PASS", "")
    else:
        rec("S8a", "Handle 获取失败不再空吞（catch 有明确动作）", "FAIL", "no Handle guard found at all")
    # 行为回归（正常路径不被新失败路径破坏）：真 java 立即退出 -> rc 正确 + pidfile 收尾。
    #   注：Handle 抛异常本身黑盒不可确定性注入（依赖 PS5.1 进程句柄时序），S8a 为静态结构断言，如实区分。
    if not os.path.isfile(JAVA):
        rec("S8b", "engine_launch 正常路径回归（真 java）", "BLOCKED", "java not found")
        return
    exit0 = os.path.join(SBX, "exit0.js")
    pidfile = os.path.join(SBX, "s8_java.pid")
    write(exit0, "Java.type('java.lang.System').exit(0);\n")
    ps = (
        ". '%s'\n"
        "$rc = Start-EngineJava -FrHome '%s' -Script '%s' -Heap '400m' -PidFile '%s'\n"
        "Write-Output ('RC=' + $rc)\n"
        "Write-Output ('PIDFILE=' + (Test-Path '%s'))\n"
    ) % (os.path.join(ROOT, "engine_launch.ps1"), FR_REAL, exit0, pidfile, pidfile)
    psscript = os.path.join(SBX, "s8_launch.ps1")
    write(psscript, ps)
    rc, out, err = sh(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psscript], timeout=180)
    mrc = re.search(r"RC=(\S+)", out or "")
    pf = read(pidfile)
    # 正常路径：rc 正确 + pidfile 留存且身份已注册（"pid ticks"，非 PENDING）——java.pid 由下一次 run 的
    #   identity 检查消费，成功 run 后本就留存（logs/agent/runs/s3t7/java.pid 基线实证）。
    if rc == 0 and mrc and mrc.group(1) == "0" and pf and re.match(r"^\d+ \d+\s*$", pf):
        rec("S8b", "engine_launch 正常路径回归（真 java rc=0、pidfile 身份已注册）", "PASS", "")
    else:
        rec("S8b", "engine_launch 正常路径回归", "FAIL", "rc=%s pidfile=%r out=%s err=%s" % (rc, (pf or "")[:40], (out or "")[:200], (err or "")[:200]))


def gate(gid, name, args, timeout, env=None):
    rc, out, err = sh(args, timeout=timeout, env=env)
    if rc is None:
        rec(gid, name, "BLOCKED", err[:200])
    elif rc == 0:
        rec(gid, name, "PASS", "")
    else:
        tail = [l for l in (out or err).strip().splitlines() if l.strip()][-4:]
        rec(gid, name, "FAIL", "; ".join(tail)[:500])


def s9_gates():
    """标准9：门禁全绿（fast15/静态门/scan/负门/基线 MD5/promote-restore 矩阵/双 e2e）。"""
    ps = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File"]
    if os.path.isfile(JAVA):
        gate("S9a", "fast15（16 套件）全绿", ps + [os.path.join(ROOT, "scripts", "run-fast-tests.ps1")], 420)
        gate("S9c", "scan_all_specs 零误伤 bad=0", [JAVA, "-cp", NASHORN, "jdk.nashorn.tools.Shell",
              os.path.join(ROOT, "probes", "scan_all_specs.js")], 600)
    else:
        rec("S9a", "fast15 全绿", "BLOCKED", "java not found")
        rec("S9c", "scan bad=0", "BLOCKED", "java not found")
    gate("S9b", "PS 静态门（parse+ASCII+无硬编路径）", ps + [os.path.join(ROOT, "verify", "check_ps1_static.ps1")], 240)
    gate("S9d", "promote/restore 回归矩阵（沙盒）", ps + [os.path.join(ROOT, "scripts", "run-promote-restore-tests.ps1")], 420)
    m = md5(os.path.join(ROOT, "demo_api.cpt"))
    rec("S9e", "默认基线 demo_api.cpt MD5 不变", "PASS" if m == BASELINE_MD5 else ("BLOCKED" if m is None else "FAIL"), "md5=%s" % m)
    if not HEAVY:
        rec("S9f", "引擎负门（失败必非零）", "NOT RUN", "--no-heavy")
        rec("S9g", "双 e2e（golden + c-maturity）", "NOT RUN", "--no-heavy")
        return
    if os.path.isfile(JAVA):
        gate("S9f", "引擎负门（失败必非零）", ps + [os.path.join(ROOT, "scripts", "run-engine-negative-tests.ps1")], 1500)
        gate("S9g1", "golden create+modify e2e", ps + [os.path.join(ROOT, "scripts", "run-golden-e2e.ps1")], 1800)
        gate("S9g2", "c-maturity 三形状 e2e", ps + [os.path.join(ROOT, "scripts", "run-c-maturity-e2e.ps1")], 1800)
    else:
        rec("S9f", "引擎负门", "BLOCKED", "java not found")
        rec("S9g", "双 e2e", "BLOCKED", "java not found")


def s10_wrapup():
    """标准10：收尾（工作区干净/已 push/night-shift-log 三态留痕/独立复审无未修 P1/P2）。"""
    rc, out, _ = sh(["git", "status", "--porcelain"], 30)
    rec("S10a", "git 工作区干净", "PASS" if rc == 0 and out.strip() == "" else "FAIL", out[:200])
    rc1, head, _ = sh(["git", "rev-parse", "HEAD"], 30)
    rc2, origin, _ = sh(["git", "rev-parse", "origin/main"], 30)
    if rc1 == 0 and rc2 == 0:
        rec("S10b", "最新 commit 已 push（origin/main 含 HEAD）", "PASS" if head.strip() == origin.strip() else "FAIL", "")
    else:
        rec("S10b", "最新 commit 已 push", "BLOCKED", "origin/main unreadable")
    log = read(os.path.join(ROOT, "docs", "night-shift-log.md")) or ""
    # 本轮条目特征 = 任务书编号（3.1-1..4 / 3.2-1..4，历史条目未用过这些编号，grep 实证零命中）
    has_31 = re.search(r"3\.1-[1-4]", log)
    has_32 = re.search(r"3\.2-[1-4]", log)
    tri = re.search(r"PASS|NOT RUN|BLOCKED", log)
    rec("S10c", "night-shift-log 含 3.1/3.2【本轮编号】三态留痕", "PASS" if (has_31 and has_32 and tri) else "FAIL",
        "3.1编号=%s 3.2编号=%s 三态=%s" % (bool(has_31), bool(has_32), bool(tri)))
    # 本轮段 = 首个 3.1-1 编号出现之后；复审结论与"未修遗留"只在本轮段内判（历史"未修→backlog"是既往账，不误伤）
    mm = re.search(r"3\.1-[1-4]", log)
    this_round = log[mm.start():] if mm else ""
    gpt = os.path.join(ROOT, "docs", "gpt")
    newest = ""
    if os.path.isdir(gpt):
        fs = sorted(n for n in os.listdir(gpt) if n.endswith(".md"))
        if fs:
            newest = read(os.path.join(gpt, fs[-1])) or ""
    has_review = bool(re.search(r"复审", this_round + newest))
    no_open_p12 = not re.search(r"未修[^\n]{0,12}P[12][^\n]{0,20}(遗留|挂\s*backlog|未关闭|backlog)", this_round)
    rec("S10d", "本轮独立复审留痕且无未修 P1/P2 遗留", "PASS" if (has_review and no_open_p12) else "FAIL",
        "review=%s openP12=%s" % (has_review, not no_open_p12))


def inventory_real_deploy():
    """真实部署目录清点（验证器自身的安全声明：验证器与沙盒用例全程只读）。返回 {name: "size:md5"}。"""
    d = os.path.join(FR_REAL, "webapps", "webroot", "WEB-INF", "reportlets", "fineagent")
    if not os.path.isdir(d):
        return {"(absent)": ""}
    items = {}
    for n in sorted(os.listdir(d)):
        fp = os.path.join(d, n)
        if os.path.isfile(fp):
            items[n] = "%d:%s" % (os.path.getsize(fp), md5(fp))
    return items


def gate_owned(name):
    return any(name.startswith(p) for p in GATE_ARTIFACT_PREFIXES)


def main():
    print("== stage3 final check (heavy=%s) ==" % HEAVY)
    inv0 = inventory_real_deploy()
    fresh_sandbox()
    s1_manifest_full_consistency()
    s2_staging_runid_binding()
    s3_crash_consistency()
    s4_concurrency_boundary()
    s5_execution_regression_split()
    s6_diff_node_context()
    s7_coordinate_mapping_evidence()
    s8_engine_launch_handle()
    s9_gates()
    s10_wrapup()
    inv1 = inventory_real_deploy()
    removed = [n for n in inv0 if n not in inv1]
    changed = [n for n in inv1 if n in inv0 and inv0[n] != inv1[n]]
    added = [n for n in inv1 if n not in inv0]
    stray = [n for n in changed + added if not gate_owned(n)]
    if removed or stray:
        rec("S0", "真实部署目录既有件全程无损（前后清点对拍，门禁自产件白名单外零变化）", "FAIL",
            "removed=%s strayChanged/Added=%s" % (removed[:6], stray[:6]))
    else:
        rec("S0", "真实部署目录既有件全程无损（前后清点对拍，门禁自产件白名单外零变化）", "PASS",
            "kept=%d files; gate-owned changed/added=%s" % (len(inv0), sorted(set(changed + added))[:8]))
    n_pass = sum(1 for r in RESULTS if r["state"] == "PASS")
    n_fail = sum(1 for r in RESULTS if r["state"] == "FAIL")
    n_blk = sum(1 for r in RESULTS if r["state"] == "BLOCKED")
    n_nr = sum(1 for r in RESULTS if r["state"] == "NOT RUN")
    print("STAGE3_CHECK END, pass=%d, fail=%d, blocked=%d, notrun=%d" % (n_pass, n_fail, n_blk, n_nr))
    print(json.dumps({"summary": {"pass": n_pass, "fail": n_fail, "blocked": n_blk, "notrun": n_nr},
                      "results": RESULTS}, ensure_ascii=False, indent=1))
    sys.exit(1 if n_fail else 0)


if __name__ == "__main__":
    main()
