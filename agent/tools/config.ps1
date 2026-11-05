# config.ps1 - r13 (R12.3/P2-C): single source of truth for agent-tool paths and runtime policy.
# Every agent tool (runtime.ps1, fr_agent.ps1) dot-sources this and calls Get-AgentConfig.
# Do NOT re-declare $ROOT/$FR/java paths per entry point again (r13 P2-C).
# NOTE: ASCII-only (PS 5.1 GBK ANSI-read lesson).
function Get-AgentConfig {
  $root = if ($env:FR_AGENT_HOME) { $env:FR_AGENT_HOME } else { 'D:\fineagent' }
  $fr   = if ($env:FR_HOME) { $env:FR_HOME } else { 'D:\software\FineReport_11.0' }
  $root = $root -replace '[\\]+$',''
  $fr   = $fr -replace '[\\]+$',''
  return [pscustomobject]@{
    Root            = $root
    FrHome          = $fr
    Java            = "$fr\jre\bin\java.exe"
    NashornJar      = "$fr\jre\lib\ext\nashorn.jar"
    AgentDir        = "$root\logs\agent"
    RunsDir         = "$root\logs\agent\runs"
    RuntimeDir      = "$root\logs\agent\runtime"
    DeployDir       = "$fr\webapps\webroot\WEB-INF\reportlets\fineagent"
    FineDbLck       = "$fr\webapps\webroot\WEB-INF\embed\finedb\db.lck"
    # runtime policy (r13): these are POLICY knobs, not owner-death signals
    Heap              = '1200m'
    AcquireTimeoutSec = 900     # waiter gives up + reclaims its queue slot after this
    InitGraceSec      = 10      # lock dir created but owner.json not yet written: treat as INITIALIZING, never delete within grace
    TaskSuspectSec    = 1800    # a live-owner task older than this => WARNING only (never kill; owner identity is the truth)
  }
}

# r13 sec.2: RunId validation lives in ONE place (shared by fr_agent.ps1 and runtime.ps1). Same rule as _lib.js checkRunId
#   (JS side is a separate language boundary; the PS rule is centralized here). Charset guard = path-traversal defense.
function Test-RunId([string]$id) {
  return ($id -match '^[A-Za-z0-9_-]{1,64}$')
}
