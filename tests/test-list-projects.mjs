#!/usr/bin/env node
// Test script for list_projects feature

import { listProjects } from '../dist/tools/primitives/listProjects.js';

async function runTests() {
  console.log('='.repeat(60));
  console.log('LIST PROJECTS FEATURE TEST');
  console.log('='.repeat(60));

  // Test 1: List all active projects
  console.log('\n1. Listing all active projects...');
  try {
    const result = await listProjects({ status: 'active', limit: 10 });
    if (result.success) {
      console.log(`   PASS - Found ${result.count} active projects`);
      if (result.projects.length > 0) {
        console.log('   First 5:');
        result.projects.slice(0, 5).forEach((p, i) => {
          console.log(`     ${i+1}. ${p.name} (${p.status}) - ${p.taskCount} tasks`);
        });
      }
    } else {
      console.log(`   FAIL - ${result.error}`);
    }
  } catch (err) {
    console.log(`   FAIL - ${err.message}`);
  }

  // Test 2: List all projects (any status)
  console.log('\n2. Listing all projects (any status)...');
  try {
    const result = await listProjects({ status: 'all', limit: 20 });
    if (result.success) {
      console.log(`   PASS - Found ${result.count} total projects`);

      // Count by status
      const statusCounts = {};
      result.projects.forEach(p => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      });
      console.log('   Status breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`     - ${status}: ${count}`);
      });
    } else {
      console.log(`   FAIL - ${result.error}`);
    }
  } catch (err) {
    console.log(`   FAIL - ${err.message}`);
  }

  // Test 3: List projects in a specific folder
  console.log('\n3. Testing folder filter...');
  try {
    // First get a project to find its folder
    const allProjects = await listProjects({ status: 'all', limit: 50 });

    if (allProjects.success && allProjects.projects.length > 0) {
      // Find a project with a folder
      const projectWithFolder = allProjects.projects.find(p => p.folderName);

      if (projectWithFolder) {
        console.log(`   Found project "${projectWithFolder.name}" in folder "${projectWithFolder.folderName}"`);

        // Now filter by that folder
        const folderResult = await listProjects({
          folderName: projectWithFolder.folderName,
          status: 'all',
          limit: 20
        });

        if (folderResult.success) {
          console.log(`   PASS - Found ${folderResult.count} projects in folder "${projectWithFolder.folderName}"`);
          folderResult.projects.slice(0, 3).forEach((p, i) => {
            console.log(`     ${i+1}. ${p.name}`);
          });
        } else {
          console.log(`   FAIL - ${folderResult.error}`);
        }
      } else {
        console.log('   SKIP - No projects with folders found');
      }
    } else {
      console.log('   SKIP - No projects found');
    }
  } catch (err) {
    console.log(`   FAIL - ${err.message}`);
  }

  // Test 4: Verify dropped folder projects excluded by default
  console.log('\n4. Testing dropped folder exclusion...');
  try {
    const withoutDropped = await listProjects({ status: 'all', includeDroppedFolders: false, limit: 100 });
    const withDropped = await listProjects({ status: 'all', includeDroppedFolders: true, limit: 100 });

    if (withoutDropped.success && withDropped.success) {
      const diff = withDropped.count - withoutDropped.count;
      if (diff > 0) {
        console.log(`   PASS - ${diff} project(s) in dropped folders excluded by default`);
      } else {
        console.log(`   INFO - No projects in dropped folders (or none exist)`);
      }
      console.log(`   Without dropped folders: ${withoutDropped.count}`);
      console.log(`   With dropped folders: ${withDropped.count}`);
    } else {
      console.log(`   FAIL - Error in comparison`);
    }
  } catch (err) {
    console.log(`   FAIL - ${err.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

runTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
