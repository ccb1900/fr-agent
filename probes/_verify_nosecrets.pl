#!/usr/bin/perl
# 泄密防波堤（可反复跑）：全工作区字节级审计（无编码死角）。
# 用法: perl _verify_nosecrets.pl
#   1) 旧连接口令字面量残留统计（data/db_local.js 里的唯一真值除外，它被 .gitignore 挡在库外）
#   2) 新表达式 load('D:/fineagent/lib/dbpass.js') 落位统计
use strict; use warnings;
use File::Find;

my $ROOT = 'D:/fineagent';
my $TOKEN = chr(39) . join('', map { chr } (119, 104, 109, 101, 105, 107, 111, 64, 49, 50, 51)) . chr(39);
my $REPL  = "load('D:/fineagent/lib/dbpass.js')";
my $SKIPDIR = qr{^\Qd:/fineagent\E/(\.git|logs|shots|verify_png)/};

my @old; my %newfiles; my $newtok = 0;   # perl 列表赋值坑：my(@a,%h,$s)=((),(),0) 会把首个 0 灌进 @a
find(sub {
  return unless -f $_;
  my $p = $File::Find::name;
  $p =~ s{\\}{\/}g;
  $p =~ s{^\QD:\/fineagent\E\/}{};
  return if lc($p) =~ $SKIPDIR;
  my $data = ''; { local $/; open my $fh, '<:raw', $p or return; $data = <$fh>; close $fh; }
  return unless defined $data;
  my ($c_old, $pos) = (0, 0);
  while ( (my $i = index($data, $TOKEN, $pos)) >= 0 ) { $c_old++; $pos = $i + 1 }
  if ($c_old) { push @old, "$File::Find::name ($c_old) [orig-name]" }
  my ($c_new, $p2) = (0, 0);
  while ( (my $i = index($data, $REPL, $p2)) >= 0 ) { $c_new++; $p2 = $i + length $REPL }
  if ($c_new) { $newfiles{$p} = $c_new; $newtok += $c_new }
}, $ROOT);

print "== old-token leftovers ==\n";
if (@old) {
  print "  $_\n" for grep { ref ne '' or !/\A\d+\z/ } @old;
  printf "  total real-entries=%d\n", scalar(grep { !/\A\d+\z/ } @old);
} else {
  print "  (none)\n";
}
{
  use Data::Dumper; local $Data::Dumper::Useqq = 1;
  open my $df, '>:raw', 'D:/fineagent/logs/audit_dump.txt' or die "audit_dump: $!\n";
  print {$df} Dumper(\@old);
  for my $e (@old) { print {$df} join(' ', map { ord } split //, $e), "\n" }
  close $df;
}
print "== loader expr ==\n";
printf "  files=%d tokens=%d\n", scalar(keys %newfiles), $newtok;
