# Virtual Gardening School

Introducing Virtual Gardening School, a user-friendly TypeScript web application dedicated to simplifying garden management and discovery. Seamlessly execute CRUD (Create, Read, Update, Delete) operations on gardens through our intuitive frontend interface, empowering users to effortlessly navigate and manage their green spaces. Moreover, Virtual Gardening School offers personalized garden recommendations, leveraging user preferences to curate tailored suggestions. Experience the future of garden management with Virtual Gardening School, where convenience meets customization for a delightful gardening experience.


## How to deploy canisters

- Start the Local Internet Computer

    ```bash
    dfx start --background --clean
    ```

    ```bash
    npm install
    ```

    ```bash
    npm install @dfinity/candid
    ```

- Deploy the Ledger Canister

    ```bash
    npm run deploy-ledger
    ```

- Deploy the Internet Identity Canister

    ```bash
    npm run deploy-identity
    ```

- Deploy the Backend Canister

    ```bash
	# run with dfx and set the registrationFee in e8s

	dfx deploy dfinity_js_backend --argument '(record {registrationFee <amount in e8s> })'

	# or run using npm with preset values
	# registraionFee = 2_0000_0000 i.e 2 ICP tokens
	sudo apt update
    npm run deploy-backend

    ```

- Deploy the Frontend Canister

    ```bash
    npm run deploy-frontend
    ```

- Run Frontend Locally

    ```bash
    npm run start
    ```

## Minting Tokens to your account

This next step shows how to mint icp tokens from the locally deployed Ledger canister.

- Copy your dfx address from the wallet on the doc reg frontend.

    ![gettokens](./img/mint.png)

- Run the mint script.

    ```bash
    # npm run mint:tokens <amount in e8s> <dfx address>
   npm run mint:tokens 5000_0000_0000 4eecc7740bf73f27f68c9f9703adbee7dc41dd1e1a5e316bbff039806550bd79

	# N/B: This mints 5000 ICP tokens from the locally deployed ledger to the address.
    ```
