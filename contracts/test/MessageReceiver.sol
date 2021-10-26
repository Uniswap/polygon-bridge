// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

/// @dev Test contract for receiving messages and emitting them as events
contract MessageReceiver {
    event Received(address sender, uint256 value, bytes data);

    fallback() external payable {
        emit Received(msg.sender, msg.value, msg.data);
    }

    receive() external payable {
        emit Received(msg.sender, msg.value, '');
    }

    function reverts() external pure {
        revert('this call reverts');
    }
}
