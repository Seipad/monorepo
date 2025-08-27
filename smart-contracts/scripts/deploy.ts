import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
dotenv.config();

async function deploy() {
  // Get private key from environment variable
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is not set');
  }

  // Create wallet from private key
  const deployer = new ethers.Wallet(privateKey, ethers.provider); // uncomment to use private key
  // const [deployer] = await ethers.getSigners();

  const router = '0x527b42CA5e11370259EcaE68561C14dA415477C8';
  console.log('Deploying contracts with the account:', deployer.address);

  // Deploy Pool implementation
  const PoolFactory = await ethers.getContractFactory('Pool');
  const PoolContract = await PoolFactory.deploy();
  const deployedPoolContract = await PoolContract.deployed();
  console.log(`Pool implementation deployed to: ${deployedPoolContract.address}`);

  // Deploy PoolManager implementation
  const PoolManagerFactory = await ethers.getContractFactory('PoolManager');
  const PoolManagerImplementation = await PoolManagerFactory.deploy();
  await PoolManagerImplementation.deployed();
  console.log(`PoolManager implementation deployed to: ${PoolManagerImplementation.address}`);

  // Deploy Proxy
  const ProxyFactory = await ethers.getContractFactory('PoolManagerProxy');

  // Prepare initialization data
  const initData = PoolManagerFactory.interface.encodeFunctionData('initialize', [
    deployedPoolContract.address, // poolImplementation
    router, // router
    deployer.address, // owner
  ]);

  const Proxy = await ProxyFactory.deploy(PoolManagerImplementation.address, initData);
  const deployedProxy = await Proxy.deployed();
  console.log(`PoolManager proxy deployed to: ${deployedProxy.address}`);

  // Initialize the Pool contract with the owner address (not proxy address)
  // await PoolContract.connect(deployer).initialize(deployer.address);
  // console.log("Pool contract initialized with owner address");

  // Verify the deployment
  console.log('\n=== Deployment Summary ===');
  console.log(`Pool Implementation: ${deployedPoolContract.address}`);
  console.log(`PoolManager Implementation: ${PoolManagerImplementation.address}`);
  console.log(`PoolManager Proxy: ${deployedProxy.address}`);
  console.log(`Router: ${router}`);
  console.log(`Owner: ${deployer.address}`);

  // Test that the proxy works by calling a function
  const proxyPoolManager = PoolManagerFactory.attach(deployedProxy.address);
  const protocolFee = await proxyPoolManager.getProtocolFeeBps();
  console.log(`\n✅ Proxy test successful! Protocol fee: ${protocolFee}`);
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
