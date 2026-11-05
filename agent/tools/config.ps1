# config.ps1 - r13/r14: single source of truth for agent-tool paths and runtime policy.
# Every agent tool (runtime.ps1, fr_agent.ps1) dot-sources this and calls Get-AgentConfig.
# Do NOT re-declare $ROOT/$FR/java paths per entry point again (r13 P2-C / r14 config single-source).
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
    # r15: thin single-instance executor. Mutual exclusion = OS named Mutex (kernel). Crash recovery = leftover-process
    #   IDENTITY check (java.pid pid+StartTime) inside the mutex; refuse when a leftover cannot be confirmed dead.
    #   No queue/, no OwnerToken, no done/ records (artifact.json is the result truth) - see docs/gpt/r15.md.
    MutexName         = 'fr-agent-fine-report-runtime'
    Heap              = if ($env:FR_AGENT_HEAP) { $env:FR_AGENT_HEAP } else { '1200m' }   # env-overridable (README #47); embedded specs need no j2v8
    AcquireTimeoutSec = 900     # waiter blocks on the mutex up to this; never steals a live holder
  }
}

# r13 sec.2 / r14: RunId validation lives in ONE place (shared by fr_agent.ps1 and runtime.ps1). Same rule as _lib.js
#   checkRunId (JS side is a separate language boundary; the PS rule is centralized here). Charset guard = path-traversal defense.
function Test-RunId([string]$id) {
  return ($id -match '^[A-Za-z0-9_-]{1,64}$')
}
