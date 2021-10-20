// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IFxMessageProcessor} from '@maticnetwork/fx-portal/contracts/tunnel/FxBaseChildTunnel.sol';

/// @title Polygon governance bridge contract
/// @dev This contract is used as a proxy for the L1 Ethereum timelock contract representing a DAO
contract PolygonBridge is IFxMessageProcessor {
    /// @notice The tunnel contract on the child network
    address public immutable fxChild;

    /// @notice The address of the L1 Timelock contract
    address public immutable l1Timelock;

    constructor(address _fxChild, address _l1Timelock) {
        fxChild = _fxChild;
        l1Timelock = _l1Timelock;
    }

    /// @dev This function is how messages are delivered from the polygon message passing contract to polygon contracts.
    function processMessageFromRoot(
        uint256, /*stateId*/
        address sender,
        bytes memory message
    ) external override {
        require(msg.sender == fxChild, 'Can only be called by the state sync child contract');
        require(sender == l1Timelock, 'L1 sender must be timelock');

        (address[] memory targets, bytes[] memory datas, uint256[] memory values) = abi.decode(
            message,
            (address[], bytes[], uint256[])
        );

        require(targets.length == datas.length && targets.length == values.length, 'Inconsistent argument lengths');
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory result) = targets[i].call{value: values[i]}(datas[i]);
            require(success, 'Sub-call failed');
        }
    }
}
