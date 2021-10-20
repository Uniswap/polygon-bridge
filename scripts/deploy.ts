import { config } from 'dotenv'
config()


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

async function main() {
  console.log(
    JSON.stringify({})
  )
}

main()
