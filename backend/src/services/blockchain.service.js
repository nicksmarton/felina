import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xA451b908c7AD183aBD55F8AD48C055Da8cb4264d';
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org';

// Contract ABI
const MEMECOIN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokensPerEth() view returns (uint256)',
  'function setTokensPerEth(uint256 newRate)',
  'event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount)',
  'event TokensPerEthUpdated(uint256 newRate)',
];

let provider = null;
let contract = null;

export const getProvider = () => {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return provider;
};

export const getContract = () => {
  if (!contract) {
    const prov = getProvider();
    contract = new ethers.Contract(CONTRACT_ADDRESS, MEMECOIN_ABI, prov);
  }
  return contract;
};

export const getContractWithSigner = (privateKey) => {
  const prov = getProvider();
  const signer = new ethers.Wallet(privateKey, prov);
  return getContract().connect(signer);
};

export const getTokenBalance = async (address) => {
  try {
    const contract = getContract();
    const balance = await contract.balanceOf(address);
    const decimals = await contract.decimals();
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    logger.error('Error getting token balance:', error);
    throw error;
  }
};

export const getExchangeRate = async () => {
  try {
    const contract = getContract();
    const rate = await contract.tokensPerEth();
    return ethers.formatEther(rate);
  } catch (error) {
    logger.error('Error getting exchange rate:', error);
    throw error;
  }
};

export const getContractBalance = async () => {
  try {
    const contract = getContract();
    const balance = await contract.balanceOf(CONTRACT_ADDRESS);
    const decimals = await contract.decimals();
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    logger.error('Error getting contract balance:', error);
    throw error;
  }
};

