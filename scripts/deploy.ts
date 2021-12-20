import { config } from 'dotenv'
config()

import EthereumProxy from '../artifacts/contracts/EthereumProxy.sol/EthereumProxy.json'

import { Wallet, providers, ContractInterface, ContractFactory, Contract } from 'ethers'

const provider = new providers.JsonRpcProvider(process.env.RPC_URL!)
const wallet = new Wallet(process.env.DEPLOY_KEY!, provider)

async function deploy(
  artifact: { contractName: string; abi: ContractInterface; bytecode: string },
  args?: string[]
): Promise<Contract> {
  const cf = new ContractFactory(artifact.abi, artifact.bytecode, wallet)
  const c = await cf.deploy(...(args ?? []))
  console.log(`Sent deploy transaction for ${artifact.contractName}: ${c.deployTransaction.hash}`)
  await provider.waitForTransaction(c.deployTransaction.hash, 1)
  console.log(`Deployed ${artifact.contractName} at ${c.address}`)
  return c
}

// same on all ethereum networks/testnets
const UNISWAP_TIMELOCK = '0x1a9C8182C09F50C8318d769245beA52c32BE35BC'

async function main() {
  const chainId = await wallet.getChainId()
  let fxChildAddress: string

  // from https://docs.polygon.technology/docs/develop/l1-l2-communication/state-transfer#pre-requisite
  switch (chainId) {
    case 137:
      fxChildAddress = '0x8397259c983751DAf40400790063935a11afa28a'
      break
    // mumbai
    case 80001:
      fxChildAddress = '0xCf73231F28B7331BBe3124B907840A94851f9f11'
      break
    default:
      throw new Error('unexpected chain id')
  }

  const bridge = await deploy(EthereumProxy, [fxChildAddress, UNISWAP_TIMELOCK])

  console.log(JSON.stringify({ bridge: bridge.address }))
}

main()
