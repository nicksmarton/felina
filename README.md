## 📦 Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/samuelmeadowbiankah/felina.git
   cd felina
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the development server:
   ```sh
   npm run dev
   ```
4. Open your browser to:
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3000

## 🔗 Smart Contract Deployment (Foundry)
1. Install Foundry:
   ```sh
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```
2. Compile the contract:
   ```sh
   forge build
   ```
3. Run tests:
   ```sh
   forge test
   ```
4. Deploy to Sepolia:
   ```sh
   forge script script/Deploy.s.sol:Deploy --rpc-url https://sepolia.infura.io/v3/YOUR_INFURA_KEY --private-key YOUR_PRIVATE_KEY --broadcast
   ```
