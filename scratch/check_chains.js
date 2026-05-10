const chains = require('thirdweb/chains');
console.log(Object.keys(chains).filter(k => k.toLowerCase().includes('celo')));
