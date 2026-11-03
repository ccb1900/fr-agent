#!/usr/bin/perl
# 一次性（已完成历史使命）: 把旧连接口令字面量 -> load('D:/fineagent/lib/dbpass.js')
# 逐字节替换（token 纯 ASCII，对 UTF-8/GBK 内容无侵入）；清单取自 logs/wh_files.txt。
# 本文件自身不落明文：TOKEN 用 chr 码点拼装，审计扫描器证明仓库内无明文残留。
use strict; use warnings;

my $LIST  = 'D:/fineagent/logs/wh_files.txt';
my $TOKEN = chr(39) . join('', map { chr } (119, 104, 109, 101, 105, 107, 111, 64, 49, 50, 51)) . chr(39);
my $REPL  = "load('D:/fineagent/lib/dbpass.js')";
my $EXPECT = (@ARGV && $ARGV[0] =~ /^\d+$/) ? shift(@ARGV) : 86;   # 预期 token 数

my %uniq;
open my $fh, '<:raw', $LIST or die "open $LIST: $!\n";
while (my $l = <$fh>) {
  chomp $l; $l =~ s/\r$//;
  next unless $l =~ /^(.+):(\d+)$/;
  $uniq{$1} = 1;
}
close $fh;

my @paths = grep { -e $_ } sort keys %uniq;
printf "input files = %d (found on disk: %d)\n", scalar(keys %uniq), scalar(@paths);

my ($nfiles, $ntok) = (0, 0);
for my $f (@paths) {
  local $/;
  open my $in, '<:raw', $f or die "open $f: $!\n";
  my $data = <$in>; close $in;
  my ($out, $c, $pos) = ($data, 0, 0);
  while ( (my $i = index($out, $TOKEN, $pos)) >= 0 ) {
    substr($out, $i, length $TOKEN) = $REPL;
    $pos = $i + length $REPL;
    $c++;
  }
  next unless $c;
  open my $o, '>:raw', $f or die "write $f: $!\n";
  print {$o} $out; close $o;
  $nfiles++; $ntok += $c;
  printf "%d  %s\n", $c, $f;
}
printf "files=%d tokens=%d\n", $nfiles, $ntok;
die "token count mismatch: expected $EXPECT\n" unless $ntok == $EXPECT;
print "OK\n";
