// @ts-check

const args = process.argv.slice(2);

function printHelp() {
  console.log(
    [
      'content-machine pilot invocation for Portarium micro-SaaS toolchain realism',
      '',
      'Usage:',
      '  node experiments/iteration-2/scenarios/micro-saas-toolchain-redo/tools/content-machine-pilot.mjs --help',
      '',
      'This deterministic pilot command stands in for the content-machine CLI in',
      'the Portarium experiment environment. It performs no publish or send effects.',
    ].join('\n'),
  );
}

if (args.length === 0 || args.includes('--help')) {
  printHelp();
  process.exit(0);
}

console.error(`Unsupported content-machine pilot arguments: ${args.join(' ')}`);
process.exit(2);
