/**
 * GraphRAG Query Script
 * 
 * Query the GraphRAG system with hybrid retrieval (vector + graph)
 * 
 * Usage:
 *   node query-graphrag.js "Your question here"
 *   node query-graphrag.js --interactive
 */

import readline from 'readline';
import { queryGraphRAG, formatQueryResult } from './src/query/queryEngine.js';

async function queryOnce(question) {
  try {
    const result = await queryGraphRAG(question, {
      topK: 5,
      graphDepth: 2,
      verbose: true,
    });

    console.log(formatQueryResult(result));
  } catch (error) {
    console.error('\n❌ Query failed:', error.message);
    process.exit(1);
  }
}

async function interactiveMode() {
  console.log('\n🤖 GraphRAG Interactive Query Mode');
  console.log('=' .repeat(60));
  console.log('Type your questions below. Type "exit" or "quit" to stop.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question('\n❓ Your question: ', async (input) => {
      const question = input.trim();

      if (!question || question.toLowerCase() === 'exit' || question.toLowerCase() === 'quit') {
        console.log('\n👋 Goodbye!\n');
        rl.close();
        return;
      }

      try {
        const result = await queryGraphRAG(question, {
          topK: 5,
          graphDepth: 2,
          verbose: false,
        });

        console.log(formatQueryResult(result));
      } catch (error) {
        console.error('\n❌ Query failed:', error.message);
      }

      askQuestion();
    });
  };

  askQuestion();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('\n📚 GraphRAG Query System\n');
    console.log('Usage:');
    console.log('  node query-graphrag.js "Your question here"');
    console.log('  node query-graphrag.js --interactive\n');
    console.log('Examples:');
    console.log('  node query-graphrag.js "Who is Sam Altman?"');
    console.log('  node query-graphrag.js "What is OpenAI working on?"');
    console.log('  node query-graphrag.js "Who invested in OpenAI?"\n');
    process.exit(0);
  }

  if (args[0] === '--interactive' || args[0] === '-i') {
    await interactiveMode();
  } else {
    const question = args.join(' ');
    await queryOnce(question);
  }
}

main();
