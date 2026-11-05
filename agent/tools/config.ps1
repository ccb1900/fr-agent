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
    # r14: OS named mutex = the single-instance guarantee (kernel-enforced mutual exclusion + abandonment on owner crash).
    #   Files (owner.json/queue/done/history) are RECORDS/state, NOT the mutex. This removes r13's time-based init reclaim
    #   and corrupt-owner reclaim (both could false-kill a live-but-slow owner). A live holder keeps the mutex so WaitOne
    #   blocks; only AbandonedMutexException (OS-proven owner death) triggers recovery.
    MutexName         = 'fr-agent-fine-report-runtime'
    Heap              = '1200m'
    AcquireTimeoutSec = 900     # waiter gives up + reclaims its queue slot after this (never steals a live holder)
    TaskSuspectSec    = 1800    # a live-owner task older than this => status WARNING only, never kill
  }
}

# r13 sec.2 / r14: RunId validation lives in ONE place (shared by fr_agent.ps1 and runtime.ps1). Same rule as _lib.js
#   checkRunId (JS side is a separate language boundary; the PS rule is centralized here). Charset guard = path-traversal defense.
function Test-RunId([string]$id) {
  return ($id -match '^[A-Za-z0-9_-]{1,64}$')
}
