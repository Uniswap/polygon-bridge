import { FxChild, EthereumProxy, MessageReceiver } from '../typechain'
import { network, ethers, waffle } from 'hardhat'
import { Fixture } from 'ethereum-waffle'
import { BigNumber, BigNumberish, constants } from 'ethers'
import { defaultAbiCoder } from '@ethersproject/abi'
import { expect } from './shared/expect'
import snapshotGasCost from './shared/snapshotGasCost'

describe('EthereumProxy', () => {
  const [funder, other] = waffle.provider.getWallets()

  const UNISWAP_TIMELOCK = '0x1a9C8182C09F50C8318d769245beA52c32BE35BC'

  let bridge: EthereumProxy
  let fxChild: FxChild
  let receiver: MessageReceiver

  const fixture: Fixture<{ bridge: EthereumProxy; fxChild: FxChild; receiver: MessageReceiver }> = async () => {
    const fxChild = (await (await ethers.getContractFactory('FxChildTest')).deploy()) as FxChild
    const bridge = (await (
      await ethers.getContractFactory('EthereumProxy')
    ).deploy(fxChild.address, UNISWAP_TIMELOCK)) as EthereumProxy
    const receiver = (await (await ethers.getContractFactory('MessageReceiver')).deploy()) as MessageReceiver
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

  it('is deployed with the proper state variables', async () => {
    expect(bridge.address).to.not.eq(constants.AddressZero)
    expect(await bridge.fxChild()).to.eq(fxChild.address)
    expect(await bridge.l1Owner()).to.eq(UNISWAP_TIMELOCK)
  })

  describe('#processMessageFromRoot', () => {
    it('reverts if called on l2 by someone else', async () => {
      await expect(bridge.processMessageFromRoot(0, other.address, '0x')).to.be.revertedWith(
        'Can only be called by the state sync child contract'
      )
    })

    it('reverts if l1 sender is not owner', async () => {
      await expect(
        sendSyncStateMessage(1, { rootMessageSender: other.address, receiver: bridge.address, data: '0x' })
      ).to.be.revertedWith('L1 sender must be the owner')
    })

    it('reverts with inconsistent argument lengths', async () => {
      const coded = defaultAbiCoder.encode(['address[]', 'bytes[]', 'uint256[]'], [[], ['0xabcd'], [0]])
      await expect(
        sendSyncStateMessage(1, {
          rootMessageSender: UNISWAP_TIMELOCK,
          receiver: bridge.address,
          data: coded,
        })
      ).to.be.revertedWith('Inconsistent argument lengths')
    })

    it('can call another contract', async () => {
      const coded = defaultAbiCoder.encode(['address[]', 'bytes[]', 'uint256[]'], [[receiver.address], ['0xabcd'], [0]])
      await expect(
        sendSyncStateMessage(1, {
          rootMessageSender: UNISWAP_TIMELOCK,
          receiver: bridge.address,
          data: coded,
        })
      )
        .to.emit(receiver, 'Received')
        .withArgs(bridge.address, 0, '0xabcd')
    })

    it('can make calls to multiple contracts', async () => {
      const receiver2 = (await (await ethers.getContractFactory('MessageReceiver')).deploy()) as MessageReceiver
      await funder.sendTransaction({ to: bridge.address, value: 10 })
      const coded = defaultAbiCoder.encode(
        ['address[]', 'bytes[]', 'uint256[]'],
        [
          [receiver.address, receiver2.address],
          ['0xabcd', '0xdeff'],
          [0, 5],
        ]
      )
      await expect(
        sendSyncStateMessage(1, {
          rootMessageSender: UNISWAP_TIMELOCK,
          receiver: bridge.address,
          data: coded,
        })
      )
        .to.emit(receiver, 'Received')
        .withArgs(bridge.address, 0, '0xabcd')
        .to.emit(receiver2, 'Received')
        .withArgs(bridge.address, 5, '0xdeff')
    })

    it('gas cost of processing a single message', async () => {
      const coded = defaultAbiCoder.encode(['address[]', 'bytes[]', 'uint256[]'], [[receiver.address], ['0xabcd'], [0]])
      await snapshotGasCost(
        sendSyncStateMessage(1, {
          rootMessageSender: UNISWAP_TIMELOCK,
          receiver: bridge.address,
          data: coded,
        })
      )
    })
  })
})
