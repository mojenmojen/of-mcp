#!/usr/bin/env node
// Test script for planned date feature

import { addOmniFocusTask } from '../dist/tools/primitives/addOmniFocusTask.js';
import { editItem } from '../dist/tools/primitives/editItem.js';
import { getTaskById } from '../dist/tools/primitives/getTaskById.js';
import { filterTasks } from '../dist/tools/primitives/filterTasks.js';

const TEST_PREFIX = '[PlannedDateTest]';

// Helper to get today's date in ISO format
function getTodayISO() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Helper to get a date N days from now
function getDateDaysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('PLANNED DATE FEATURE TESTS');
  console.log('='.repeat(60));

  const results = [];
  let createdTaskId = null;

  // Test 1: Create task with planned date
  console.log('\n📋 Test 1: Create task with planned date');
  try {
    const plannedDate = getDateDaysFromNow(3); // 3 days from now
    const result = await addOmniFocusTask({
      name: `${TEST_PREFIX} Task with planned date`,
      plannedDate: plannedDate
    });

    if (result.success && result.taskId) {
      createdTaskId = result.taskId;
      console.log(`   ✅ PASS - Task created with ID: ${result.taskId}`);
      console.log(`   Planned date set to: ${plannedDate}`);
      results.push({ test: 'Create task with planned date', passed: true });
    } else {
      console.log(`   ❌ FAIL - ${result.error}`);
      results.push({ test: 'Create task with planned date', passed: false, error: result.error });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Create task with planned date', passed: false, error: err.message });
  }

  // Test 2: Verify planned date in get_task_by_id
  console.log('\n📋 Test 2: Verify planned date in get_task_by_id');
  try {
    if (!createdTaskId) throw new Error('No task ID from previous test');

    const result = await getTaskById({ taskId: createdTaskId });

    if (result.success && result.task) {
      if (result.task.plannedDate) {
        console.log(`   ✅ PASS - Planned date found: ${result.task.plannedDate}`);
        results.push({ test: 'Verify planned date in get_task_by_id', passed: true });
      } else {
        console.log(`   ❌ FAIL - plannedDate field is null/undefined`);
        results.push({ test: 'Verify planned date in get_task_by_id', passed: false, error: 'plannedDate is null' });
      }
    } else {
      console.log(`   ❌ FAIL - ${result.error}`);
      results.push({ test: 'Verify planned date in get_task_by_id', passed: false, error: result.error });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Verify planned date in get_task_by_id', passed: false, error: err.message });
  }

  // Test 3: Create task for today (for filter test)
  console.log('\n📋 Test 3: Create task planned for today');
  let todayTaskId = null;
  try {
    const today = getTodayISO();
    const result = await addOmniFocusTask({
      name: `${TEST_PREFIX} Task planned for today`,
      plannedDate: today
    });

    if (result.success && result.taskId) {
      todayTaskId = result.taskId;
      console.log(`   ✅ PASS - Task created with ID: ${result.taskId}`);
      console.log(`   Planned date set to: ${today}`);
      results.push({ test: 'Create task planned for today', passed: true });
    } else {
      console.log(`   ❌ FAIL - ${result.error}`);
      results.push({ test: 'Create task planned for today', passed: false, error: result.error });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Create task planned for today', passed: false, error: err.message });
  }

  // Test 4: Filter tasks planned for today
  console.log('\n📋 Test 4: Filter tasks with plannedToday');
  try {
    const result = await filterTasks({ plannedToday: true });

    // Result is a formatted string, check if our task is included
    if (result && result.includes(TEST_PREFIX)) {
      console.log(`   ✅ PASS - Found test task in plannedToday filter results`);
      results.push({ test: 'Filter tasks with plannedToday', passed: true });
    } else if (result && result.includes('No tasks match')) {
      console.log(`   ❌ FAIL - No tasks found for plannedToday filter`);
      results.push({ test: 'Filter tasks with plannedToday', passed: false, error: 'No tasks found' });
    } else {
      console.log(`   ⚠️ PARTIAL - Got results but test task not found`);
      results.push({ test: 'Filter tasks with plannedToday', passed: false, error: 'Task not in results' });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Filter tasks with plannedToday', passed: false, error: err.message });
  }

  // Test 5: Filter tasks planned for this week
  console.log('\n📋 Test 5: Filter tasks with plannedThisWeek');
  try {
    const result = await filterTasks({ plannedThisWeek: true });

    if (result && result.includes(TEST_PREFIX)) {
      console.log(`   ✅ PASS - Found test task in plannedThisWeek filter results`);
      results.push({ test: 'Filter tasks with plannedThisWeek', passed: true });
    } else if (result && result.includes('No tasks match')) {
      console.log(`   ❌ FAIL - No tasks found for plannedThisWeek filter`);
      results.push({ test: 'Filter tasks with plannedThisWeek', passed: false, error: 'No tasks found' });
    } else {
      console.log(`   ⚠️ PARTIAL - Got results but test task not found`);
      results.push({ test: 'Filter tasks with plannedThisWeek', passed: false, error: 'Task not in results' });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Filter tasks with plannedThisWeek', passed: false, error: err.message });
  }

  // Test 6: Edit task to change planned date
  console.log('\n📋 Test 6: Edit task to change planned date');
  try {
    if (!createdTaskId) throw new Error('No task ID from previous test');

    const newPlannedDate = getDateDaysFromNow(10); // 10 days from now
    const result = await editItem({
      id: createdTaskId,
      itemType: 'task',
      newPlannedDate: newPlannedDate
    });

    if (result.success && result.changedProperties && result.changedProperties.includes('planned date')) {
      console.log(`   ✅ PASS - Planned date updated to ${newPlannedDate}`);
      results.push({ test: 'Edit task to change planned date', passed: true });
    } else if (result.success) {
      console.log(`   ⚠️ PARTIAL - Edit succeeded but changedProperties: ${result.changedProperties}`);
      results.push({ test: 'Edit task to change planned date', passed: true });
    } else {
      console.log(`   ❌ FAIL - ${result.error}`);
      results.push({ test: 'Edit task to change planned date', passed: false, error: result.error });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Edit task to change planned date', passed: false, error: err.message });
  }

  // Test 7: Edit task to clear planned date
  console.log('\n📋 Test 7: Edit task to clear planned date');
  try {
    if (!todayTaskId) throw new Error('No today task ID from previous test');

    const result = await editItem({
      id: todayTaskId,
      itemType: 'task',
      newPlannedDate: '' // empty string to clear
    });

    if (result.success && result.changedProperties && result.changedProperties.includes('planned date')) {
      console.log(`   ✅ PASS - Planned date cleared`);
      results.push({ test: 'Edit task to clear planned date', passed: true });
    } else if (result.success) {
      console.log(`   ⚠️ PARTIAL - Edit succeeded but changedProperties: ${result.changedProperties}`);
      results.push({ test: 'Edit task to clear planned date', passed: true });
    } else {
      console.log(`   ❌ FAIL - ${result.error}`);
      results.push({ test: 'Edit task to clear planned date', passed: false, error: result.error });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Edit task to clear planned date', passed: false, error: err.message });
  }

  // Test 8: Verify planned date was cleared
  console.log('\n📋 Test 8: Verify planned date was cleared');
  try {
    if (!todayTaskId) throw new Error('No today task ID from previous test');

    const result = await getTaskById({ taskId: todayTaskId });

    if (result.success && result.task) {
      if (!result.task.plannedDate) {
        console.log(`   ✅ PASS - Planned date is now null/undefined`);
        results.push({ test: 'Verify planned date was cleared', passed: true });
      } else {
        console.log(`   ❌ FAIL - Planned date still has value: ${result.task.plannedDate}`);
        results.push({ test: 'Verify planned date was cleared', passed: false, error: 'plannedDate not cleared' });
      }
    } else {
      console.log(`   ❌ FAIL - ${result.error}`);
      results.push({ test: 'Verify planned date was cleared', passed: false, error: result.error });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Verify planned date was cleared', passed: false, error: err.message });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    console.log(`${status} ${r.test}`);
    if (!r.passed && r.error) {
      console.log(`   Error: ${r.error}`);
    }
  });

  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('-'.repeat(60));

  // Cleanup reminder
  console.log('\n⚠️  Remember to delete test tasks from OmniFocus:');
  console.log(`   Search for "${TEST_PREFIX}" to find them`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
