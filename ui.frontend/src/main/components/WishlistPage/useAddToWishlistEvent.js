/*******************************************************************************
 *
 *    Copyright 2021 Adobe. All rights reserved.
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
import { useEventListener } from '../utils/hooks';
import defaultOperations from '@magento/peregrine/lib/talons/Wishlist/AddToListButton/addToListButton.gql';
import mergeOperations from '@magento/peregrine/lib/util/shallowMerge';
import { useMutation } from '@apollo/client';

const useAddToWishlistEvent = (props = {}) => {
    const operations = mergeOperations(defaultOperations, props.operations);
    const [addProductToWishlist] = useMutation(operations.addProductToWishlistMutation);

    useEventListener(document, 'aem.cif.add-to-wishlist', async event => {
        const items = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
        console.log('wishlist event item', items);
        items.forEach(item => {
            addProductToWishlist({
                variables: { wishlistId: '0', itemOptions: item }
            });
        });
    });
};

export default useAddToWishlistEvent;
