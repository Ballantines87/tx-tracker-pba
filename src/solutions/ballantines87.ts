import type {
    API,
    FinalizedEvent,
    IncomingEvent,
    NewBlockEvent,
    NewTransactionEvent,
    OutputAPI,
    Settled,
} from "../types"

export default function ballantines87(api: API, outputApi: OutputAPI) {
    // Using an array to trrack all incoming transactions IN ORDER
    const pendingTxs: string[] = []

    // Maps transaction hash to the block where it was settled
    const settledTxsToBlockMap = new Map<
        string, // tx hash
        {
            settledIn: string   // settled block
            state: Settled
        }
    >()

    // Tracking block parents to keep track of inheritance
    const blockToParentMap = new Map<string, string>()


    // new incoming block event
    const onNewBlock = ({ blockHash, parent }: NewBlockEvent) => {

        // store the blockHash key with its parent block as value to keep track of the chain of "inheritance"
        blockToParentMap.set(blockHash, parent)

        // store the body of the incoming new block
        const body = api.getBody(blockHash)

        // iterating through the blocks of an array
        pendingTxs.forEach(tx => {

            // if the block body contains tx ...
            if (body.includes(tx)) {
                // ... pre-set its state to Settled
                let state: Settled
                // if tx is invalid
                if (!api.isTxValid(blockHash, tx)) {
                    // ... set state to invalid
                    state = { blockHash, type: "invalid" }
                } else {
                    // else set it to valid 
                    const successful = api.isTxSuccessful(blockHash, tx)
                    state = { blockHash, type: "valid", successful }
                }

                // check if it has NOT been included earlier -> it NOT INCLUDE and BROARDCAST SETTLED
                if (!settledTxsToBlockMap.has(tx)) {
                    settledTxsToBlockMap.set(tx, { settledIn: blockHash, state })
                    outputApi.onTxSettled(tx, state)
                }
            }
        })
    }


    // new incoming transaction event
    const onNewTx = ({ value: transaction }: NewTransactionEvent) => {
        pendingTxs.push(transaction)
    }

    // block finalized event
    const onFinalized = ({ blockHash }: FinalizedEvent) => {

        // check each tr -> entry in the settledTxsToBlockMap 
        for (const [tx, { settledIn, state }] of settledTxsToBlockMap.entries()) {
            // is this a settled block or descendant of a settled block? if yes report to user
            if (isDescendant(blockHash, settledIn)) {

                // notify the user that tx is done!
                outputApi.onTxDone(tx, state)
                settledTxsToBlockMap.delete(tx)
                // Can remove tx from pendingTxs 
                const index = pendingTxs.indexOf(tx)
            }
        }

    }

    // Helper checkin if it is a settled block or is a descendant of one
    const isDescendant = (ancestor: string, descendant: string): boolean => {
        let current = descendant

        // 
        while (current !== ancestor && blockToParentMap.has(current)) {
            // go back in the chain of "inheritance"
            current = blockToParentMap.get(current)!
        }
        return current === ancestor
    }


    /**** UNPINNING: TO IMPLEMENT */

    return (event: IncomingEvent) => {
        switch (event.type) {
            case "newTransaction":
                onNewTx(event)
                break
            case "newBlock":
                onNewBlock(event)
                break
            case "finalized":
                onFinalized(event)
                break
        }
    }
}