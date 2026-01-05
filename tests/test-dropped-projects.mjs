#!/usr/bin/env node
// Test script to verify dropped projects are filtered correctly

import { getProjectsForReview } from '../dist/tools/primitives/getProjectsForReview.js';
import { getProjectById } from '../dist/tools/primitives/getProjectById.js';

async function runTests() {
  console.log('='.repeat(60));
  console.log('DROPPED PROJECTS FILTER TEST');
  console.log('='.repeat(60));

  // Test 1: Get projects for review and check none are dropped
  console.log('\n1. Getting projects for review (includeOnHold: true)...');
  try {
    const result = await getProjectsForReview({ includeOnHold: true, limit: 100 });

    if (result.success) {
      console.log(`   Found ${result.totalCount} projects needing review`);

      // Check if any returned projects have "Dropped" status
      const droppedProjects = result.projects?.filter(p => p.status === 'Dropped') || [];

      if (droppedProjects.length === 0) {
        console.log('   PASS - No dropped projects in results');
      } else {
        console.log(`   FAIL - Found ${droppedProjects.length} dropped project(s):`);
        droppedProjects.forEach(p => {
          console.log(`     - ${p.name} (ID: ${p.id})`);
        });
      }

      // Show first few projects for verification
      if (result.projects && result.projects.length > 0) {
        console.log('\n   First 5 projects returned:');
        result.projects.slice(0, 5).forEach((p, i) => {
          console.log(`     ${i+1}. ${p.name} (Status: ${p.status})`);
        });
      }
    } else {
      console.log(`   Error: ${result.error}`);
    }
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }

  // Test 2: Check a specific project that was reported as dropped
  // (skating lessons - ID: bnWsoATC-lj from bug report)
  console.log('\n2. Checking "skating lessons" project status...');
  try {
    const result = await getProjectById({ projectId: 'bnWsoATC-lj' });

    if (result.success && result.project) {
      console.log(`   Project: ${result.project.name}`);
      console.log(`   Status: ${result.project.status}`);

      if (result.project.status === 'Dropped') {
        console.log('   PASS - Project correctly shows as Dropped');
      } else {
        console.log(`   INFO - Status is ${result.project.status} (may no longer be dropped)`);
      }
    } else {
      console.log(`   Project not found (may have been deleted)`);
    }
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

runTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
