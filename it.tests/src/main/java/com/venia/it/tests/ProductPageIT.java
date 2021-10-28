/*******************************************************************************
 *
 *    Copyright 2020 Adobe. All rights reserved.
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

package com.venia.it.tests;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

import org.apache.http.NameValuePair;
import org.apache.http.message.BasicNameValuePair;
import org.apache.sling.testing.clients.ClientException;
import org.apache.sling.testing.clients.SlingHttpResponse;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.select.Elements;
import org.junit.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.venia.it.utils.Utils;

import static org.junit.Assert.assertEquals;

public class ProductPageIT extends CommerceTestBase {

    private static final String PRODUCT_SELECTOR = ".product ";
    private static final String PRODUCT_DETAILS_SELECTOR = PRODUCT_SELECTOR + "> .productFullDetail__root";
    private static final String PRODUCT_NAME_SELECTOR = PRODUCT_SELECTOR + ".productFullDetail__productName > span";
    private static final String GROUPED_PRODUCTS_SELECTOR = PRODUCT_SELECTOR + ".productFullDetail__groupedProducts";

    @Test
    public void testProductPageWithSampleData() throws ClientException, IOException {
        String pagePath = VENIA_CONTENT_US_EN_PRODUCTS_PRODUCT_PAGE + ".html/honora-wide-leg-pants.html";
        SlingHttpResponse response = adminAuthor.doGet(pagePath, 200);
        Document doc = Jsoup.parse(response.getContent());

        // Verify product name
        Elements elements = doc.select(PRODUCT_NAME_SELECTOR);
        assertEquals("Honora Wide Leg Pants", elements.first().html());

        // Verify that the section for GroupedProduct is NOT displayed
        assertEquals(0, doc.select(GROUPED_PRODUCTS_SELECTOR).size());

        // Verify breadcrumb: Home > Bottoms > Pants & Shorts > Honora Wide Leg Pants
        elements = doc.select(BREADCRUMB_ITEMS_SELECTOR);
        assertEquals(4, elements.size());

        // Check the number of root elements in the navigation menu
        elements = doc.select(NAVIGATION_ITEM_SELECTOR);
        assertEquals(6, elements.size());

        // Check the meta data
        elements = doc.select("title");
        assertEquals("Honora Wide Leg Pants", elements.first().html());

        // todo CIF-2511
        // temporally disabled assertion because of failure related to CIF-2262 - test will be refactored later
        // elements = doc.select("link[rel=canonical]");
        // assertEquals("http://localhost:4502" + pagePath, elements.first().attr("href"));

        // Verify dataLayer attributes
        elements = doc.select(PRODUCT_DETAILS_SELECTOR);
        JsonNode result = Utils.OBJECT_MAPPER.readTree(elements.first().attr("data-cmp-data-layer"));
        JsonNode expected = Utils.OBJECT_MAPPER.readTree(Utils.getResource("datalayer/simple-product.json"));
        assertEquals(expected, result);
    }

    @Test
    public void testProductPageWithSampleDataForGroupedProduct() throws ClientException, IOException {
        SlingHttpResponse response = adminAuthor.doGet(VENIA_CONTENT_US_EN_PRODUCTS_PRODUCT_PAGE + ".html/augusta-trio.html", 200);
        Document doc = Jsoup.parse(response.getContent());

        // Verify product name
        Elements elements = doc.select(PRODUCT_NAME_SELECTOR);
        assertEquals("Augusta Trio", elements.first().html());

        // Verify that the section for GroupedProduct is displayed
        assertEquals(1, doc.select(GROUPED_PRODUCTS_SELECTOR).size());

        // Verify dataLayer attributes
        elements = doc.select(PRODUCT_DETAILS_SELECTOR);
        JsonNode result = Utils.OBJECT_MAPPER.readTree(elements.first().attr("data-cmp-data-layer"));
        JsonNode expected = Utils.OBJECT_MAPPER.readTree(Utils.getResource("datalayer/grouped-product.json"));
        assertEquals(expected, result);
    }

    @Test
    public void testProductPageWithPlaceholderData() throws ClientException, IOException {
        SlingHttpResponse response = adminAuthor.doGet(VENIA_CONTENT_US_EN_PRODUCTS_PRODUCT_PAGE + ".html", 200);
        Document doc = Jsoup.parse(response.getContent());

        // Verify product name
        Elements elements = doc.select(PRODUCT_NAME_SELECTOR);
        assertEquals("Product name", elements.first().html());

        // Verify breadcrumb: Home
        elements = doc.select(BREADCRUMB_ITEMS_SELECTOR);
        assertEquals(1, elements.size());

        // Verify dataLayer attributes
        elements = doc.select(PRODUCT_DETAILS_SELECTOR);
        JsonNode result = Utils.OBJECT_MAPPER.readTree(elements.first().attr("data-cmp-data-layer"));
        JsonNode expected = Utils.OBJECT_MAPPER.readTree(Utils.getResource("datalayer/placeholder-product.json"));
        assertEquals(expected, result);
    }

    @Test
    public void testProductNotFoundPage() throws ClientException {
        String pagePath = VENIA_CONTENT_US_EN_PRODUCTS_PRODUCT_PAGE + ".html/unknown-product.html";
        List<NameValuePair> params = Collections.singletonList(new BasicNameValuePair("wcmmode","disabled"));
        SlingHttpResponse response = adminAuthor.doGet(pagePath, params, 404);
        Document doc = Jsoup.parse(response.getContent());

        Elements elements = doc.select(H1_SELECTOR);
        assertEquals("Ruh-Roh! Page Not Found",elements.first().text());
    }
}
