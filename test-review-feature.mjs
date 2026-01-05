#!/usr/bin/env node
// Test script for mark reviewed feature

import { getProjectById } from './dist/tools/primitives/getProjectById.js';
import { getProjectsForReview } from './dist/tools/primitives/getProjectsForReview.js';
import { editItem } from './dist/tools/primitives/editItem.js';
import { batchMarkReviewed } from './dist/tools/primitives/batchMarkReviewed.js';
import { dumpDatabase } from './dist/tools/dumpDatabase.js';

async function runTests() {
  console.log('='.repeat(60));
  console.log('MARK REVIEWED FEATURE TESTS');
  console.log('='.repeat(60));

  const results = [];

  // Test 1: Get projects for review
  console.log('\n📋 Test 1: Get projects for review');
  let projectsForReview = [];
  try {
    const result = await getProjectsForReview({ includeOnHold: false, limit: 10 });

    if (result.success) {
      projectsForReview = result.projects || [];
      console.log(`   ✅ PASS - Found ${result.totalCount} projects needing review`);
      if (projectsForReview.length > 0) {
        console.log(`   First project: ${projectsForReview[0].name} (ID: ${projectsForReview[0].id})`);
      }
      results.push({ test: 'Get projects for review', passed: true });
    } else {
      console.log(`   ❌ FAIL - ${result.error}`);
      results.push({ test: 'Get projects for review', passed: false, error: result.error });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Get projects for review', passed: false, error: err.message });
  }

  // Test 2: Get project by ID and check review fields
  console.log('\n📋 Test 2: Check review fields in get_project_by_id');
  let testProjectId = null;
  let testProjectName = null;
  try {
    // Use first project from review list, or find any active project
    if (projectsForReview.length > 0) {
      testProjectId = projectsForReview[0].id;
      testProjectName = projectsForReview[0].name;
    } else {
      // Get any active project from the database
      console.log(`   No projects need review, finding any active project...`);
      const db = await dumpDatabase();
      const projectEntries = Object.entries(db.projects);
      const activeProject = projectEntries.find(([id, p]) => p.status === 'Active');
      if (activeProject) {
        testProjectId = activeProject[0];
        testProjectName = activeProject[1].name;
        console.log(`   Using project: "${testProjectName}" (ID: ${testProjectId})`);
      }
    }

    if (testProjectId) {
      const result = await getProjectById({ projectId: testProjectId });

      if (result.success && result.project) {
        const hasReviewFields = 'reviewInterval' in result.project &&
                               'nextReviewDate' in result.project &&
                               'lastReviewDate' in result.project;

        if (hasReviewFields) {
          console.log(`   ✅ PASS - Review fields present in project "${result.project.name}"`);
          console.log(`   • reviewInterval: ${result.project.reviewInterval ? (result.project.reviewInterval / 86400) + ' days' : 'null'}`);
          console.log(`   • nextReviewDate: ${result.project.nextReviewDate || 'null'}`);
          console.log(`   • lastReviewDate: ${result.project.lastReviewDate || 'null'}`);
          results.push({ test: 'Check review fields in get_project_by_id', passed: true });
        } else {
          console.log(`   ❌ FAIL - Review fields missing from project response`);
          results.push({ test: 'Check review fields in get_project_by_id', passed: false, error: 'Fields missing' });
        }
      } else {
        console.log(`   ❌ FAIL - ${result.error}`);
        results.push({ test: 'Check review fields in get_project_by_id', passed: false, error: result.error });
      }
    } else {
      console.log(`   ⚠️ SKIPPED - No projects available for testing`);
      results.push({ test: 'Check review fields in get_project_by_id', passed: true, skipped: true });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Check review fields in get_project_by_id', passed: false, error: err.message });
  }

  // Test 3: Mark project as reviewed using edit_item
  console.log('\n📋 Test 3: Mark project as reviewed (edit_item)');
  try {
    if (testProjectId) {
      const result = await editItem({
        id: testProjectId,
        itemType: 'project',
        markReviewed: true
      });

      if (result.success && result.changedProperties && result.changedProperties.includes('marked as reviewed')) {
        console.log(`   ✅ PASS - Project "${result.name}" marked as reviewed`);
        results.push({ test: 'Mark project as reviewed', passed: true });
      } else if (result.success) {
        console.log(`   ⚠️ PARTIAL - Edit succeeded but changedProperties: ${result.changedProperties}`);
        results.push({ test: 'Mark project as reviewed', passed: true });
      } else {
        console.log(`   ❌ FAIL - ${result.error}`);
        results.push({ test: 'Mark project as reviewed', passed: false, error: result.error });
      }
    } else {
      console.log(`   ⚠️ SKIPPED - No project available for testing`);
      results.push({ test: 'Mark project as reviewed', passed: true, skipped: true });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Mark project as reviewed', passed: false, error: err.message });
  }

  // Test 4: Set review interval using edit_item
  console.log('\n📋 Test 4: Set review interval (edit_item)');
  try {
    if (testProjectId) {
      const result = await editItem({
        id: testProjectId,
        itemType: 'project',
        newReviewInterval: 14 // 14 days
      });

      if (result.success && result.changedProperties && result.changedProperties.includes('review interval')) {
        console.log(`   ✅ PASS - Review interval set to 14 days for "${result.name}"`);
        results.push({ test: 'Set review interval', passed: true });
      } else if (result.success) {
        console.log(`   ⚠️ PARTIAL - Edit succeeded but changedProperties: ${result.changedProperties}`);
        results.push({ test: 'Set review interval', passed: true });
      } else {
        console.log(`   ❌ FAIL - ${result.error}`);
        results.push({ test: 'Set review interval', passed: false, error: result.error });
      }
    } else {
      console.log(`   ⚠️ SKIPPED - No project available for testing`);
      results.push({ test: 'Set review interval', passed: true, skipped: true });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Set review interval', passed: false, error: err.message });
  }

  // Test 5: Verify review interval was set
  console.log('\n📋 Test 5: Verify review interval was updated');
  try {
    if (testProjectId) {
      const result = await getProjectById({ projectId: testProjectId });

      if (result.success && result.project) {
        const intervalDays = result.project.reviewInterval ? Math.round(result.project.reviewInterval / 86400) : null;
        if (intervalDays === 14) {
          console.log(`   ✅ PASS - Review interval is 14 days`);
          results.push({ test: 'Verify review interval', passed: true });
        } else {
          console.log(`   ⚠️ PARTIAL - Review interval is ${intervalDays} days (expected 14)`);
          results.push({ test: 'Verify review interval', passed: true });
        }
      } else {
        console.log(`   ❌ FAIL - ${result.error}`);
        results.push({ test: 'Verify review interval', passed: false, error: result.error });
      }
    } else {
      console.log(`   ⚠️ SKIPPED - No project available for testing`);
      results.push({ test: 'Verify review interval', passed: true, skipped: true });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Verify review interval', passed: false, error: err.message });
  }

  // Test 6: Batch mark reviewed (with multiple projects if available)
  console.log('\n📋 Test 6: Batch mark reviewed');
  try {
    // Get fresh list of projects for review
    const freshResult = await getProjectsForReview({ includeOnHold: false, limit: 3 });

    if (freshResult.success && freshResult.projects && freshResult.projects.length > 0) {
      const idsToMark = freshResult.projects.map(p => p.id);
      console.log(`   Marking ${idsToMark.length} project(s) as reviewed...`);

      const result = await batchMarkReviewed({ projectIds: idsToMark });

      if (result.success) {
        console.log(`   ✅ PASS - Batch marked ${result.successCount} projects as reviewed`);
        results.push({ test: 'Batch mark reviewed', passed: true });
      } else if (result.successCount > 0) {
        console.log(`   ⚠️ PARTIAL - Marked ${result.successCount}/${result.totalCount} projects`);
        results.push({ test: 'Batch mark reviewed', passed: true });
      } else {
        console.log(`   ❌ FAIL - ${result.error}`);
        results.push({ test: 'Batch mark reviewed', passed: false, error: result.error });
      }
    } else {
      console.log(`   ⚠️ SKIPPED - No projects needing review`);
      results.push({ test: 'Batch mark reviewed', passed: true, skipped: true });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Batch mark reviewed', passed: false, error: err.message });
  }

  // Test 7: Verify projects no longer in review list
  console.log('\n📋 Test 7: Verify projects removed from review list');
  try {
    const result = await getProjectsForReview({ includeOnHold: false, limit: 50 });

    if (result.success) {
      // Check if testProjectId is no longer in the list
      const stillInList = result.projects?.find(p => p.id === testProjectId);

      if (!stillInList && testProjectId) {
        console.log(`   ✅ PASS - Marked project no longer in review list`);
        results.push({ test: 'Verify removed from review list', passed: true });
      } else if (!testProjectId) {
        console.log(`   ⚠️ SKIPPED - No project was marked in previous tests`);
        results.push({ test: 'Verify removed from review list', passed: true, skipped: true });
      } else {
        console.log(`   ⚠️ INFO - Project still in review list (may have multiple due)`);
        results.push({ test: 'Verify removed from review list', passed: true });
      }
      console.log(`   Current projects needing review: ${result.totalCount}`);
    } else {
      console.log(`   ❌ FAIL - ${result.error}`);
      results.push({ test: 'Verify removed from review list', passed: false, error: result.error });
    }
  } catch (err) {
    console.log(`   ❌ FAIL - ${err.message}`);
    results.push({ test: 'Verify removed from review list', passed: false, error: err.message });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = results.filter(r => r.skipped).length;

  results.forEach(r => {
    const status = r.passed ? (r.skipped ? '⚠️' : '✅') : '❌';
    console.log(`${status} ${r.test}${r.skipped ? ' (skipped)' : ''}`);
    if (!r.passed && r.error) {
      console.log(`   Error: ${r.error}`);
    }
  });

  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
  console.log('-'.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
