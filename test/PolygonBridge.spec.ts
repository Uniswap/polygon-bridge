import { FxChild, PolygonBridge, L2MessageReceiver } from '../typechain'
import { network, ethers, waffle } from 'hardhat'
import { Fixture } from 'ethereum-waffle'
import { BigNumber, BigNumberish, constants } from 'ethers'
import { defaultAbiCoder } from '@ethersproject/abi'
import { expect } from './shared/expect'

describe('PolygonBridge', () => {
  const [funder, other] = waffle.provider.getWallets()

  const UNISWAP_TIMELOCK = '0x1a9C8182C09F50C8318d769245beA52c32BE35BC'

  let bridge: PolygonBridge
  let fxChild: FxChild
  let receiver: L2MessageReceiver

  const fixture: Fixture<{ bridge: PolygonBridge; fxChild: FxChild; receiver: L2MessageReceiver }> = async () => {
    const fxChild = (await (await ethers.getContractFactory('FxChildTest')).deploy()) as FxChild
    const bridge = (await (
      await ethers.getContractFactory('PolygonBridge')
    ).deploy(fxChild.address, UNISWAP_TIMELOCK)) as PolygonBridge
    const receiver = (await (await ethers.getContractFactory('L2MessageReceiver')).deploy()) as L2MessageReceiver
    return { bridge, fxChild, receiver }
  }

  beforeEach('deploy the bridge', async () => {
    ;({ bridge, fxChild, receiver } = await waffle.loadFixture(fixture))
  })

  async function sendSyncStateMessage(
    stateId: BigNumberish,
    data: {
      rootMessageSender: string
      receiver: string
      data: string
    }
  ) {
    await funder.sendTransaction({
      value: BigNumber.from(10).pow(18),
      to: '0x0000000000000000000000000000000000001001',
    })

    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: ['0x0000000000000000000000000000000000001001'],
    })

    const signer = await ethers.getSigner('0x0000000000000000000000000000000000001001')
    const connectedFxChild = fxChild.connect(signer)
    const tx = await connectedFxChild.onStateReceive(
      stateId,
      defaultAbiCoder.encode(['address', 'address', 'bytes'], [data.rootMessageSender, data.receiver, data.data])
    )

    await network.provider.request({
      method: 'hardhat_stopImpersonatingAccount',
      params: ['0x0000000000000000000000000000000000001001'],
    })
    return tx
  }

  it('is deployed', async () => {
    expect(bridge.address).to.not.eq(constants.AddressZero)
    expect(await bridge.fxChild()).to.eq(fxChild.address)
    expect(await bridge.l1Timelock()).to.eq(UNISWAP_TIMELOCK)
  })

  it('can call another contract', async () => {
    const coded = defaultAbiCoder.encode(['address[]', 'bytes[]', 'uint256[]'], [[receiver.address], ['0xabcd'], [0]])
    await expect(
      sendSyncStateMessage(1, {
        rootMessageSender: UNISWAP_TIMELOCK,
        receiver: bridge.address,
        data: coded,
      })
    ).to.emit(receiver, 'Received')
  })
})
