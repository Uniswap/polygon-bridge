import { PolygonBridgeTest } from '../typechain'
import { ethers } from 'hardhat'

describe('PolygonBridge', () => {
  let choices: PolygonBridgeTest

  beforeEach('deploy the bridge',async () => {
    choices = (await (await ethers.getContractFactory('PolygonBridgeTest')).deploy()) as PolygonBridgeTest
  })


})
