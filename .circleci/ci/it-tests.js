/*******************************************************************************
 *
 *    Copyright 2019 Adobe. All rights reserved.
 *    This file is licensed to you under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License. You may obtain a copy
 *    of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software distributed under
 *    the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 *    OF ANY KIND, either express or implied. See the License for the specific language
 *    governing permissions and limitations under the License.
 *
 ******************************************************************************/

'use strict';

const ci = new (require('./ci.js'))();
ci.context();
const qpPath = '/home/circleci/cq';
const { TYPE } = process.env;

try {
    ci.stage("Integration Tests");
    let veniaVersion = ci.sh('mvn help:evaluate -Dexpression=project.version -q -DforceStdout', true);
    let classifier = process.env.AEM;

    ci.dir(qpPath, () => {
        // Connect to QP
        ci.sh('./qp.sh -v bind --server-hostname localhost --server-port 55555');
        
        // We install the graphql-client by default except with the CIF Add-On
        let extras = '--bundle com.adobe.commerce.cif:graphql-client:1.6.1:jar';
        if (classifier == 'classic') {
            // The core components are already installed in the Cloud SDK
            extras += ' --bundle com.adobe.cq:core.wcm.components.all:2.9.0:zip';
        } else if (classifier == 'cloud') {
            // Download the CIF Add-On
            ci.sh(`curl -s "${process.env.CIF_ADDON_URL}" -o cif-addon.far`);
            extras = '--install-file cif-addon.far';
        }

        // Start CQ
        ci.sh(`./qp.sh -v start --id author --runmode author --port 4502 --qs-jar /home/circleci/cq/author/cq-quickstart.jar \
            --bundle org.apache.sling:org.apache.sling.junit.core:1.0.23:jar \
            --bundle com.adobe.commerce.cif:core-cif-components-examples-bundle:1.3.0:jar \
            ${extras} \
            --install-file /home/circleci/build/all/target/venia.all-${veniaVersion}-${classifier}.zip \
            --vm-options \\\"-Xmx1536m -XX:MaxPermSize=256m -Djava.awt.headless=true -javaagent:${process.env.JACOCO_AGENT}=destfile=crx-quickstart/jacoco-it.exec\\\"`);
    });

    // Run integration tests
    if (TYPE === 'integration') {
        ci.dir('it.tests', () => {
            ci.sh(`mvn clean verify -U -B -Plocal,${classifier}`); // The -Plocal profile comes from the AEM archetype 
        });
    }
    if (TYPE === 'selenium') {
        ci.dir('ui.tests', () => {
            ci.sh('mvn test -U -B -Pui-tests-local-execution -DHEADLESS_BROWSER=true -DSELENIUM-BROWSER=chrome');
        });
    }
    
    ci.dir(qpPath, () => {
        // Stop CQ
        ci.sh('./qp.sh -v stop --id author');
    });

} finally { 
    // Copy tests results
    ci.sh('mkdir test-reports');
    if (TYPE === 'integration') {
        ci.sh('cp -r it.tests/target/failsafe-reports test-reports/it.tests');
    }
    if (TYPE === 'selenium') {
        ci.sh('cp -r ui.tests/test-module/reports test-reports/ui.tests');
    }
    
    // Always download logs from AEM container
    ci.sh('mkdir logs');
    ci.dir('logs', () => {
        // A webserver running inside the AEM container exposes the logs folder, so we can download log files as needed.
        ci.sh('curl -O -f http://localhost:3000/crx-quickstart/logs/error.log');
        ci.sh('curl -O -f http://localhost:3000/crx-quickstart/logs/stdout.log');
        ci.sh('curl -O -f http://localhost:3000/crx-quickstart/logs/stderr.log');
        ci.sh(`find . -name '*.log' -type f -size +32M -exec echo 'Truncating: ' {} \\; -execdir truncate --size 32M {} +`);
    });
}