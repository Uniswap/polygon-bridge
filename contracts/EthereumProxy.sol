// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IFxMessageProcessor} from '@maticnetwork/fx-portal/contracts/tunnel/FxBaseChildTunnel.sol';

/// @title Ethereum proxy contract
/// @dev This contract represents another contract on L1
contract EthereumProxy is IFxMessageProcessor {
    /// @notice The tunnel contract on the child network, i.e. Polygon
    address public immutable fxChild;

    /// @notice The address of the L1 owner contract, i.e. Ethereum L1 owner address
    address public immutable l1Owner;

    constructor(address _fxChild, address _l1Owner) {
        fxChild = _fxChild;
        l1Owner = _l1Owner;
    }

    /// @dev Emitted when this contract simply receives some currency
    event Received(uint256 value);

    /// @dev If necessary, this contract can accept funds so that it may send funds
    receive() external payable {
        emit Received(msg.value);
    }

    /// @dev This function is how messages are delivered from the polygon message passing contract to polygon contracts.
    function processMessageFromRoot(
        uint256, /*stateId*/
        address sender,
        bytes memory message
    ) external override {
        require(msg.sender == fxChild, 'Can only be called by the state sync child contract');
        require(sender == l1Owner, 'L1 sender must be the owner');

        (address[] memory targets, bytes[] memory datas, uint256[] memory values) = abi.decode(
            message,
            (address[], bytes[], uint256[])
        );

        require(targets.length == datas.length && targets.length == values.length, 'Inconsistent argument lengths');
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call{value: values[i]}(datas[i]);
            require(success, 'Sub-call failed');
        }
    }
}
