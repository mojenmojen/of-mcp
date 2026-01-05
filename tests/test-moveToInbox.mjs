#!/usr/bin/env node
// Test script for moveToInbox fix

import { addOmniFocusTask } from '../dist/tools/primitives/addOmniFocusTask.js';
import { editItem } from '../dist/tools/primitives/editItem.js';
import { getInboxTasks } from '../dist/tools/primitives/getInboxTasks.js';
import { removeItem } from '../dist/tools/primitives/removeItem.js';
import { addProject } from '../dist/tools/primitives/addProject.js';

async function runTests() {
  console.log('='.repeat(60));
  console.log('MOVE TO INBOX FIX TEST');
  console.log('='.repeat(60));

  const results = [];
  let testTaskId = null;
  let testProjectId = null;
  const testProjectName = `_TEST_PROJECT_INBOX_${Date.now()}`;
  const testTaskName = `_TEST_TASK_INBOX_${Date.now()}`;

  // Test 1: Create a test project
  console.log('\n1. Creating test project...');
  try {
    const result = await addProject({ name: testProjectName });
    if (result.success) {
      testProjectId = result.projectId;
      console.log(`   Created project: ${testProjectName} (ID: ${testProjectId})`);
      results.push({ test: 'Create test project', passed: true });
    } else {
      console.log(`   FAIL - ${result.error}`);
      results.push({ test: 'Create test project', passed: false, error: result.error });
    }
  } catch (err) {
    console.log(`   FAIL - ${err.message}`);
    results.push({ test: 'Create test project', passed: false, error: err.message });
  }

  // Test 2: Create a task in the project
  console.log('\n2. Creating test task in project...');
  try {
    const result = await addOmniFocusTask({
      name: testTaskName,
      projectName: testProjectName
    });
    if (result.success) {
      testTaskId = result.taskId;
      console.log(`   Created task: ${testTaskName} (ID: ${testTaskId})`);
      results.push({ test: 'Create task in project', passed: true });
    } else {
      console.log(`   FAIL - ${result.error}`);
      results.push({ test: 'Create task in project', passed: false, error: result.error });
    }
  } catch (err) {
    console.log(`   FAIL - ${err.message}`);
    results.push({ test: 'Create task in project', passed: false, error: err.message });
  }

  // Test 3: Verify task is NOT in inbox
  console.log('\n3. Verifying task is NOT in inbox initially...');
  try {
    const inboxOutput = await getInboxTasks({ hideCompleted: true });
    // Check if our task ID appears in the inbox output
    const foundInInbox = inboxOutput.includes(testTaskId);
    if (!foundInInbox) {
      console.log(`   Task is NOT in inbox (correct)`);
      results.push({ test: 'Task not in inbox initially', passed: true });
    } else {
      console.log(`   FAIL - Task is already in inbox`);
      results.push({ test: 'Task not in inbox initially', passed: false, error: 'Task already in inbox' });
    }
  } catch (err) {
    console.log(`   FAIL - ${err.message}`);
    results.push({ test: 'Task not in inbox initially', passed: false, error: err.message });
  }

  // Test 4: Move task to inbox using edit_item
  console.log('\n4. Moving task to inbox using edit_item...');
  try {
    const result = await editItem({
      id: testTaskId,
      itemType: 'task',
      moveToInbox: true
    });
    if (result.success) {
      console.log(`   edit_item succeeded: ${result.changedProperties}`);
      results.push({ test: 'Move task to inbox', passed: true });
    } else {
      console.log(`   FAIL - ${result.error}`);
      results.push({ test: 'Move task to inbox', passed: false, error: result.error });
    }
  } catch (err) {
    console.log(`   FAIL - ${err.message}`);
    results.push({ test: 'Move task to inbox', passed: false, error: err.message });
  }

  // Test 5: Verify task IS now in inbox
  console.log('\n5. Verifying task IS now in inbox...');
  try {
    const inboxOutput = await getInboxTasks({ hideCompleted: true });
    // Check if our task ID appears in the inbox output
    const foundInInbox = inboxOutput.includes(testTaskId);
    if (foundInInbox) {
      console.log(`   SUCCESS - Task is now in inbox!`);
      results.push({ test: 'Task in inbox after move', passed: true });
    } else {
      console.log(`   FAIL - Task is NOT in inbox after moveToInbox`);
      console.log(`   Inbox output: ${inboxOutput.substring(0, 200)}...`);
      results.push({ test: 'Task in inbox after move', passed: false, error: 'Task not found in inbox' });
    }
  } catch (err) {
    console.log(`   FAIL - ${err.message}`);
    results.push({ test: 'Task in inbox after move', passed: false, error: err.message });
  }

  // Clean up: Remove test task
  console.log('\n6. Cleaning up test task...');
  try {
    if (testTaskId) {
      const result = await removeItem({ id: testTaskId, itemType: 'task' });
      if (result.success) {
        console.log(`   Deleted task: ${testTaskName}`);
      } else {
        console.log(`   Warning: Could not delete task - ${result.error}`);
      }
    }
  } catch (err) {
    console.log(`   Warning: Could not delete task - ${err.message}`);
  }

  // Clean up: Remove test project
  console.log('\n7. Cleaning up test project...');
  try {
    if (testProjectId) {
      const result = await removeItem({ id: testProjectId, itemType: 'project' });
      if (result.success) {
        console.log(`   Deleted project: ${testProjectName}`);
      } else {
        console.log(`   Warning: Could not delete project - ${result.error}`);
      }
    }
  } catch (err) {
    console.log(`   Warning: Could not delete project - ${err.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    const status = r.passed ? '  PASS' : '  FAIL';
    console.log(`${status} ${r.test}`);
    if (!r.passed && r.error) {
      console.log(`       Error: ${r.error}`);
    }
  });

  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('-'.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
